import { Injectable } from '@nestjs/common';
import type { Grant } from '@prisma/client';
import { conflict, notFound } from '../../common/errors/domain-errors';
import { dateOnly, parseDate } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExpenseResponseDto } from '../billing/expenses.dto';
import { ExpensesService } from '../billing/expenses.service';
import type {
  CreateGrantDto,
  GrantQueryDto,
  GrantResponseDto,
  LinkExpenseDto,
  UpdateGrantDto,
} from './grants.dto';

const ENTITY_TYPE = 'GRANT';

/**
 * Seguimiento de subvenciones: importe concedido y cobrado (informativos) y gastos imputados para
 * la justificación. No genera asientos: el cobro se contabiliza en el diario (cuenta 740/4708).
 */
@Injectable()
export class GrantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly expenses: ExpensesService,
  ) {}

  async list(query: GrantQueryDto): Promise<GrantResponseDto[]> {
    const rows = await this.prisma.grant.findMany({
      where: { deletedAt: null, year: query.year },
      include: { expenses: { select: { expenseId: true } } },
      orderBy: [{ year: 'desc' }, { justificationDeadline: 'asc' }, { title: 'asc' }],
    });
    const expenses = await this.expenses.findManyByIds([
      ...new Set(rows.flatMap((row) => row.expenses.map((link) => link.expenseId))),
    ]);
    const byId = new Map(expenses.map((expense) => [expense.id, ExpenseResponseDto.from(expense)]));
    return rows.map((row) =>
      this.toResponse(
        row,
        row.expenses.map((link) => byId.get(link.expenseId)).filter((e) => e !== undefined),
      ),
    );
  }

  async create(dto: CreateGrantDto): Promise<GrantResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.grant.create({
        data: {
          issuer: dto.issuer.trim(),
          title: dto.title.trim(),
          year: dto.year,
          activity: dto.activity,
          awardedCents: toBigInt(dto.awarded_cents),
          receivedCents: toBigInt(dto.received_cents ?? 0),
          justificationDeadline: parseDate(dto.justification_deadline) ?? null,
          status: dto.status,
          reference: dto.reference?.trim() || null,
          notes: dto.notes ?? null,
        },
      });
      const response = this.toResponse(created, []);
      await this.audit.record(
        {
          action: 'grants.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateGrantDto): Promise<GrantResponseDto> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.grant.update({
        where: { id },
        data: {
          issuer: dto.issuer?.trim() ?? undefined,
          title: dto.title?.trim() ?? undefined,
          year: dto.year ?? undefined,
          activity: dto.activity ?? undefined,
          awardedCents: dto.awarded_cents === undefined ? undefined : toBigInt(dto.awarded_cents),
          receivedCents:
            dto.received_cents === undefined ? undefined : toBigInt(dto.received_cents),
          justificationDeadline: parseDate(dto.justification_deadline),
          status: dto.status ?? undefined,
          reference: dto.reference === undefined ? undefined : dto.reference?.trim() || null,
          notes: dto.notes,
        },
      });
      await this.audit.record(
        {
          action: 'grants.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: this.toResponse(before, []),
          after: this.toResponse(updated, []),
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.grant.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          action: 'grants.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: this.toResponse(before, []),
        },
        tx,
      );
    });
  }

  async linkExpense(id: string, dto: LinkExpenseDto): Promise<GrantResponseDto> {
    await this.findRowOrFail(id);
    await this.expenses.assertExists(dto.expense_id);
    const existing = await this.prisma.grantExpense.findUnique({
      where: { grantId_expenseId: { grantId: id, expenseId: dto.expense_id } },
    });
    if (existing) throw conflict('ALREADY_LINKED', 'Expense is already linked to this grant');
    await this.prisma.$transaction(async (tx) => {
      await tx.grantExpense.create({ data: { grantId: id, expenseId: dto.expense_id } });
      await this.audit.record(
        { action: 'grants.expense_linked', entityType: ENTITY_TYPE, entityId: id, metadata: dto },
        tx,
      );
    });
    return this.findOne(id);
  }

  async unlinkExpense(id: string, expenseId: string): Promise<GrantResponseDto> {
    await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.grantExpense.delete({ where: { grantId_expenseId: { grantId: id, expenseId } } });
      await this.audit.record(
        {
          action: 'grants.expense_unlinked',
          entityType: ENTITY_TYPE,
          entityId: id,
          metadata: { expense_id: expenseId },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  /** Plazos de justificación próximos (alertas del panel de inicio). */
  async upcomingDeadlines(until: Date): Promise<{ id: string; title: string; deadline: string }[]> {
    const rows = await this.prisma.grant.findMany({
      where: {
        deletedAt: null,
        justificationDeadline: { lte: until },
        status: { in: ['PENDING', 'IN_PREPARATION'] },
      },
      orderBy: { justificationDeadline: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      deadline: dateOnly(row.justificationDeadline)!,
    }));
  }

  private async findOne(id: string): Promise<GrantResponseDto> {
    const row = await this.prisma.grant.findFirst({
      where: { id, deletedAt: null },
      include: { expenses: { select: { expenseId: true } } },
    });
    if (!row) throw notFound('Grant');
    const expenses = await this.expenses.findManyByIds(row.expenses.map((link) => link.expenseId));
    return this.toResponse(
      row,
      expenses.map((expense) => ExpenseResponseDto.from(expense)),
    );
  }

  private async findRowOrFail(id: string): Promise<Grant> {
    const row = await this.prisma.grant.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound('Grant');
    return row;
  }

  private toResponse(row: Grant, expenses: ExpenseResponseDto[]): GrantResponseDto {
    return {
      id: row.id,
      issuer: row.issuer,
      title: row.title,
      year: row.year,
      activity: row.activity,
      awarded_cents: toNumber(row.awardedCents),
      received_cents: toNumber(row.receivedCents),
      justification_deadline: dateOnly(row.justificationDeadline),
      status: row.status,
      reference: row.reference,
      notes: row.notes,
      justified_cents: expenses.reduce((sum, expense) => sum + expense.total_cents, 0),
      expenses,
    };
  }
}
