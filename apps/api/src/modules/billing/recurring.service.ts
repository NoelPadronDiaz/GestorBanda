import { Injectable } from '@nestjs/common';
import type { RecurringPartyType } from '@prisma/client';
import { invalidField, notFound } from '../../common/errors/domain-errors';
import { addMonths, parseDate } from '../../common/utils/dates';
import { toBigInt } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type CreateRecurringExpenseDto,
  RecurringExpenseResponseDto,
  type UpdateRecurringExpenseDto,
} from './recurring.dto';

const ENTITY_TYPE = 'RECURRING_EXPENSE';
const INCLUDE = { supplier: true, worker: true } as const;
const FREQUENCY_MONTHS = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 } as const;

/**
 * Plantillas de gastos periódicos. Avanzar un vencimiento NO marca nada como pagado ni crea
 * facturas, nóminas o asientos: es un recordatorio.
 */
@Injectable()
export class RecurringExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RecurringExpenseResponseDto[]> {
    const rows = await this.prisma.recurringExpense.findMany({
      include: INCLUDE,
      orderBy: [{ active: 'desc' }, { nextDueOn: 'asc' }],
    });
    return rows.map((row) => RecurringExpenseResponseDto.from(row));
  }

  /** Vencimientos activos hasta una fecha (alertas del panel de inicio). */
  async dueUntil(date: Date): Promise<RecurringExpenseResponseDto[]> {
    const rows = await this.prisma.recurringExpense.findMany({
      where: { active: true, nextDueOn: { lte: date } },
      include: INCLUDE,
      orderBy: { nextDueOn: 'asc' },
    });
    return rows.map((row) => RecurringExpenseResponseDto.from(row));
  }

  async create(dto: CreateRecurringExpenseDto): Promise<RecurringExpenseResponseDto> {
    const party = await this.resolveParty(dto.party_type, dto.supplier_id, dto.worker_id);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.recurringExpense.create({
        data: {
          concept: dto.concept.trim(),
          partyType: dto.party_type,
          ...party,
          activity: dto.activity,
          amountCents: toBigInt(dto.amount_cents),
          frequency: dto.frequency,
          nextDueOn: parseDate(dto.next_due_on),
          active: dto.active ?? true,
        },
        include: INCLUDE,
      });
      const response = RecurringExpenseResponseDto.from(created);
      await this.audit.record(
        {
          action: 'recurring_expenses.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateRecurringExpenseDto): Promise<RecurringExpenseResponseDto> {
    const before = await this.findRowOrFail(id);
    const partyType = dto.party_type ?? before.partyType;
    const party =
      dto.party_type !== undefined || dto.supplier_id !== undefined || dto.worker_id !== undefined
        ? await this.resolveParty(
            partyType,
            dto.supplier_id === undefined ? before.supplierId : dto.supplier_id,
            dto.worker_id === undefined ? before.workerId : dto.worker_id,
          )
        : {};
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.recurringExpense.update({
        where: { id },
        data: {
          concept: dto.concept?.trim() ?? undefined,
          partyType,
          ...party,
          activity: dto.activity ?? undefined,
          amountCents: dto.amount_cents === undefined ? undefined : toBigInt(dto.amount_cents),
          frequency: dto.frequency ?? undefined,
          nextDueOn: dto.next_due_on ? parseDate(dto.next_due_on) : undefined,
          active: dto.active ?? undefined,
        },
        include: INCLUDE,
      });
      const response = RecurringExpenseResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'recurring_expenses.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: RecurringExpenseResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async advance(id: string): Promise<RecurringExpenseResponseDto> {
    const before = await this.findRowOrFail(id);
    const next = addMonths(before.nextDueOn, FREQUENCY_MONTHS[before.frequency]);
    return this.update(id, { next_due_on: next.toISOString().slice(0, 10) });
  }

  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.recurringExpense.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'recurring_expenses.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: RecurringExpenseResponseDto.from(before),
        },
        tx,
      );
    });
  }

  private async findRowOrFail(id: string) {
    const row = await this.prisma.recurringExpense.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw notFound('Recurring expense');
    return row;
  }

  private async resolveParty(
    type: RecurringPartyType,
    supplierId: string | null | undefined,
    workerId: string | null | undefined,
  ): Promise<{ supplierId: string | null; workerId: string | null }> {
    if (type === 'WORKER') {
      if (!workerId) throw invalidField('worker_id', 'worker_id is required for WORKER templates');
      const worker = await this.prisma.worker.findFirst({
        where: { id: workerId, deletedAt: null },
      });
      if (!worker) throw notFound('Worker');
      return { supplierId: null, workerId };
    }
    if (supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: supplierId, deletedAt: null },
      });
      if (!supplier) throw notFound('Supplier');
    }
    return { supplierId: supplierId ?? null, workerId: null };
  }
}
