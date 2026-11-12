import { Injectable } from '@nestjs/common';
import type { BudgetKind, BudgetLine } from '@prisma/client';
import { conflict, invalidField, notFound } from '../../common/errors/domain-errors';
import { yearRange } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import type {
  BudgetLineResponseDto,
  BudgetQueryDto,
  BudgetReportDto,
  CreateBudgetLineDto,
  UpdateBudgetLineDto,
} from './budgets.dto';

/** Presupuestos anuales por actividad, comparados con lo contabilizado en el diario. */
@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly journal: JournalService,
  ) {}

  async report(query: BudgetQueryDto): Promise<BudgetReportDto> {
    const rows = await this.prisma.budgetLine.findMany({
      where: { year: query.year, activity: query.activity },
      orderBy: [{ kind: 'asc' }, { activity: 'asc' }, { accountPrefix: 'asc' }],
    });
    const activities = [...new Set(rows.map((row) => row.activity))];
    const netByActivity = new Map(
      await Promise.all(
        activities.map(
          async (activity) =>
            [
              activity,
              await this.journal.netByAccount({
                entryDate: yearRange(query.year),
                activity,
                sourceType: { notIn: ['REGULARIZATION', 'CLOSING'] },
              }),
            ] as const,
        ),
      ),
    );
    const lines = rows.map((row) => {
      let actual = 0;
      for (const [code, sums] of netByActivity.get(row.activity) ?? []) {
        if (!code.startsWith(row.accountPrefix)) continue;
        actual += row.kind === 'INCOME' ? sums.credit - sums.debit : sums.debit - sums.credit;
      }
      return this.toResponse(row, actual);
    });
    const sum = (kind: BudgetKind, field: 'amount_cents' | 'actual_cents') =>
      lines.filter((line) => line.kind === kind).reduce((acc, line) => acc + line[field], 0);
    return {
      lines,
      income_budget_cents: sum('INCOME', 'amount_cents'),
      income_actual_cents: sum('INCOME', 'actual_cents'),
      expense_budget_cents: sum('EXPENSE', 'amount_cents'),
      expense_actual_cents: sum('EXPENSE', 'actual_cents'),
    };
  }

  async create(dto: CreateBudgetLineDto): Promise<BudgetLineResponseDto> {
    this.assertKindMatchesAccount(dto.kind, dto.account_prefix);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.budgetLine.create({
        data: {
          year: dto.year,
          activity: dto.activity,
          kind: dto.kind,
          accountPrefix: dto.account_prefix,
          label: dto.label.trim(),
          amountCents: toBigInt(dto.amount_cents),
        },
      });
      const response = this.toResponse(created, 0);
      await this.audit.record(
        {
          action: 'budget_lines.created',
          entityType: 'BUDGET_LINE',
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateBudgetLineDto): Promise<BudgetLineResponseDto> {
    const before = await this.findRowOrFail(id);
    this.assertKindMatchesAccount(
      dto.kind ?? before.kind,
      dto.account_prefix ?? before.accountPrefix,
    );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.budgetLine.update({
        where: { id },
        data: {
          year: dto.year ?? undefined,
          activity: dto.activity ?? undefined,
          kind: dto.kind ?? undefined,
          accountPrefix: dto.account_prefix ?? undefined,
          label: dto.label?.trim() ?? undefined,
          amountCents: dto.amount_cents === undefined ? undefined : toBigInt(dto.amount_cents),
        },
      });
      const response = this.toResponse(updated, 0);
      await this.audit.record(
        {
          action: 'budget_lines.updated',
          entityType: 'BUDGET_LINE',
          entityId: id,
          before: this.toResponse(before, 0),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.budgetLine.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'budget_lines.deleted',
          entityType: 'BUDGET_LINE',
          entityId: id,
          before: this.toResponse(before, 0),
        },
        tx,
      );
    });
  }

  /** Copia las partidas de un ejercicio al siguiente (sin pisar las que ya existan). */
  async copyYear(from: number): Promise<{ copied: number }> {
    const rows = await this.prisma.budgetLine.findMany({ where: { year: from } });
    if (!rows.length) throw conflict('NOTHING_TO_COPY', 'The source year has no budget lines');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.budgetLine.createMany({
        data: rows.map((row) => ({
          year: from + 1,
          activity: row.activity,
          kind: row.kind,
          accountPrefix: row.accountPrefix,
          label: row.label,
          amountCents: row.amountCents,
        })),
        skipDuplicates: true,
      });
      await this.audit.record(
        {
          action: 'budget_lines.copied',
          entityType: 'BUDGET_LINE',
          metadata: { from, to: from + 1, copied: result.count },
        },
        tx,
      );
      return { copied: result.count };
    });
  }

  private async findRowOrFail(id: string): Promise<BudgetLine> {
    const row = await this.prisma.budgetLine.findUnique({ where: { id } });
    if (!row) throw notFound('Budget line');
    return row;
  }

  private assertKindMatchesAccount(kind: BudgetKind, prefix: string): void {
    if ((kind === 'INCOME') !== prefix.startsWith('7')) {
      throw invalidField(
        'account_prefix',
        'Income lines use group 7 accounts; expense lines, group 6',
      );
    }
  }

  private toResponse(row: BudgetLine, actual: number): BudgetLineResponseDto {
    const amount = toNumber(row.amountCents);
    return {
      id: row.id,
      year: row.year,
      activity: row.activity,
      kind: row.kind,
      account_prefix: row.accountPrefix,
      label: row.label,
      amount_cents: amount,
      actual_cents: actual,
      deviation_cents: actual - amount,
    };
  }
}
