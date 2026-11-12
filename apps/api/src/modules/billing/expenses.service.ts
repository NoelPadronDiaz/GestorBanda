import { Injectable } from '@nestjs/common';
import type { Expense, PaymentMethod, Prisma, Supplier } from '@prisma/client';
import { applyRate } from '@alcaravan/shared';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { conflict, notFound } from '../../common/errors/domain-errors';
import { parseDate, yearRange } from '../../common/utils/dates';
import { percentToBp, toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type CreateExpenseDto,
  ExpenseResponseDto,
  type ExpenseTotalsDto,
  type ListExpensesQueryDto,
  type MarkExpensePaidDto,
  type PaginatedExpensesDto,
  type UpdateExpenseDto,
} from './expenses.dto';
import { SuppliersService } from './suppliers.service';

const ENTITY_TYPE = 'EXPENSE';

export type ExpenseWithSupplier = Expense & { supplier: Supplier };

interface Amounts {
  baseCents: number;
  taxRateBp: number;
  taxCents: number;
  otherCents: number;
  withholdingRateBp: number;
  withholdingCents: number;
}

/** Propietario de expense (facturas recibidas). */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly suppliers: SuppliersService,
  ) {}

  async list(query: ListExpensesQueryDto): Promise<PaginatedExpensesDto> {
    const search = query.q?.trim();
    const where: Prisma.ExpenseWhereInput = {
      issueDate: query.year ? yearRange(query.year) : undefined,
      activity: query.activity,
      status: query.status,
      supplierId: query.supplier_id,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { concept: { contains: search, mode: 'insensitive' } },
              { supplier: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { supplier: true },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.expense.count({ where }),
    ]);
    return {
      data: rows.map((row) => ExpenseResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  async totals(year?: number): Promise<ExpenseTotalsDto> {
    const where: Prisma.ExpenseWhereInput = { issueDate: year ? yearRange(year) : undefined };
    const [all, pending] = await Promise.all([
      this.prisma.expense.aggregate({ where, _count: true, _sum: { totalCents: true } }),
      this.prisma.expense.aggregate({
        where: { ...where, status: 'PENDING' },
        _count: true,
        _sum: { totalCents: true },
      }),
    ]);
    return {
      count: all._count,
      total_cents: toNumber(all._sum.totalCents),
      pending_count: pending._count,
      pending_cents: toNumber(pending._sum.totalCents),
    };
  }

  async findOneOrFail(id: string): Promise<ExpenseResponseDto> {
    return ExpenseResponseDto.from(await this.findRowOrFail(id));
  }

  async findRowOrFail(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ExpenseWithSupplier> {
    const row = await tx.expense.findUnique({ where: { id }, include: { supplier: true } });
    if (!row) throw notFound('Expense');
    return row;
  }

  async assertExists(id: string): Promise<void> {
    await this.findRowOrFail(id);
  }

  async create(dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    await this.suppliers.findRowOrFail(dto.supplier_id);
    const amounts = this.amounts(dto);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          supplierId: dto.supplier_id,
          number: dto.number.trim(),
          issueDate: parseDate(dto.issue_date),
          operationDate: parseDate(dto.operation_date) ?? null,
          activity: dto.activity,
          category: dto.category,
          concept: dto.concept.trim(),
          ...this.amountColumns(amounts),
          notes: dto.notes ?? null,
        },
        include: { supplier: true },
      });
      const response = ExpenseResponseDto.from(created);
      await this.audit.record(
        {
          action: 'expenses.created',
          entityType: ENTITY_TYPE,
          entityId: created.id,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async update(id: string, dto: UpdateExpenseDto): Promise<ExpenseResponseDto> {
    const before = await this.findRowOrFail(id);
    this.assertNotAccounted(before);
    if (dto.supplier_id) await this.suppliers.findRowOrFail(dto.supplier_id);

    const touchesAmounts = [
      dto.base_cents,
      dto.tax_rate,
      dto.tax_cents,
      dto.other_cents,
      dto.withholding_rate,
      dto.withholding_cents,
    ].some((value) => value !== undefined);
    const amounts = touchesAmounts
      ? this.amounts({
          base_cents: dto.base_cents ?? toNumber(before.baseCents),
          tax_rate: dto.tax_rate ?? before.taxRateBp / 100,
          // Si cambian base o tipo y no llega la cuota, se recalcula.
          tax_cents:
            dto.tax_cents ??
            (dto.base_cents === undefined && dto.tax_rate === undefined
              ? toNumber(before.taxCents)
              : undefined),
          other_cents: dto.other_cents ?? toNumber(before.otherCents),
          withholding_rate: dto.withholding_rate ?? before.withholdingRateBp / 100,
          withholding_cents:
            dto.withholding_cents ??
            (dto.base_cents === undefined && dto.withholding_rate === undefined
              ? toNumber(before.withholdingCents)
              : undefined),
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          supplierId: dto.supplier_id ?? undefined,
          number: dto.number?.trim() ?? undefined,
          issueDate: dto.issue_date ? parseDate(dto.issue_date) : undefined,
          operationDate: parseDate(dto.operation_date),
          activity: dto.activity ?? undefined,
          category: dto.category ?? undefined,
          concept: dto.concept?.trim() ?? undefined,
          ...(amounts ? this.amountColumns(amounts) : {}),
          notes: dto.notes,
        },
        include: { supplier: true },
      });
      const response = ExpenseResponseDto.from(updated);
      await this.audit.record(
        {
          action: 'expenses.updated',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: ExpenseResponseDto.from(before),
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  async markPaid(id: string, dto: MarkExpensePaidDto): Promise<ExpenseResponseDto> {
    const before = await this.findRowOrFail(id);
    return this.setPayment(before, parseDate(dto.paid_on), dto.payment_method);
  }

  async markPending(id: string): Promise<ExpenseResponseDto> {
    const before = await this.findRowOrFail(id);
    if (before.paymentEntryId) {
      throw conflict(
        'PAYMENT_ACCOUNTED',
        'The payment is accounted; reverse its journal entry first',
      );
    }
    return this.setPayment(before, null, null);
  }

  /** Borrado físico, solo antes de contabilizar (las imputaciones a subvenciones caen en cascada). */
  async remove(id: string): Promise<void> {
    const before = await this.findRowOrFail(id);
    this.assertNotAccounted(before);
    if (before.paymentEntryId) throw conflict('PAYMENT_ACCOUNTED', 'Expense payment is accounted');
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'expenses.deleted',
          entityType: ENTITY_TYPE,
          entityId: id,
          before: ExpenseResponseDto.from(before),
        },
        tx,
      );
    });
  }

  // ── Usados por Contabilidad, Fiscalidad y Subvenciones ──

  async linkAccrualEntry(
    tx: Prisma.TransactionClient,
    id: string,
    entryId: string | null,
  ): Promise<void> {
    await tx.expense.update({ where: { id }, data: { journalEntryId: entryId } });
  }

  async linkPaymentEntry(
    tx: Prisma.TransactionClient,
    id: string,
    payment: { entryId: string; paidOn: Date; method: PaymentMethod } | null,
  ): Promise<void> {
    await tx.expense.update({
      where: { id },
      data: payment
        ? {
            paymentEntryId: payment.entryId,
            status: 'PAID',
            paidOn: payment.paidOn,
            paymentMethod: payment.method,
          }
        : { paymentEntryId: null, status: 'PENDING', paidOn: null, paymentMethod: null },
    });
  }

  async listIssuedBetween(from: Date, to: Date): Promise<ExpenseWithSupplier[]> {
    return this.prisma.expense.findMany({
      where: { issueDate: { gte: from, lte: to } },
      include: { supplier: true },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    });
  }

  /** Facturas con retención pagadas en el periodo (criterio de caja de los modelos 111/190). */
  async listWithholdingsPaidBetween(from: Date, to: Date): Promise<ExpenseWithSupplier[]> {
    return this.prisma.expense.findMany({
      where: { status: 'PAID', paidOn: { gte: from, lte: to }, withholdingCents: { gt: 0 } },
      include: { supplier: true },
      orderBy: [{ paidOn: 'asc' }, { number: 'asc' }],
    });
  }

  async findManyByIds(ids: string[]): Promise<ExpenseWithSupplier[]> {
    if (!ids.length) return [];
    return this.prisma.expense.findMany({
      where: { id: { in: ids } },
      include: { supplier: true },
      orderBy: { issueDate: 'asc' },
    });
  }

  private assertNotAccounted(expense: Expense): void {
    if (expense.journalEntryId) {
      throw conflict('EXPENSE_ACCOUNTED', 'Expense is accounted; reverse its journal entry first');
    }
  }

  private amounts(dto: {
    base_cents: number;
    tax_rate: number;
    tax_cents?: number;
    other_cents?: number;
    withholding_rate?: number;
    withholding_cents?: number;
  }): Amounts {
    const taxRateBp = percentToBp(dto.tax_rate);
    const withholdingRateBp = percentToBp(dto.withholding_rate ?? 0);
    return {
      baseCents: dto.base_cents,
      taxRateBp,
      taxCents: dto.tax_cents ?? applyRate(dto.base_cents, taxRateBp),
      otherCents: dto.other_cents ?? 0,
      withholdingRateBp,
      withholdingCents: dto.withholding_cents ?? applyRate(dto.base_cents, withholdingRateBp),
    };
  }

  /** El total nunca lo envía el cliente: se deriva, y un CHECK de la BD lo garantiza. */
  private amountColumns(a: Amounts) {
    return {
      baseCents: toBigInt(a.baseCents),
      taxRateBp: a.taxRateBp,
      taxCents: toBigInt(a.taxCents),
      otherCents: toBigInt(a.otherCents),
      withholdingRateBp: a.withholdingRateBp,
      withholdingCents: toBigInt(a.withholdingCents),
      totalCents: toBigInt(a.baseCents + a.taxCents + a.otherCents - a.withholdingCents),
    };
  }

  private async setPayment(
    before: ExpenseWithSupplier,
    paidOn: Date | null,
    method: PaymentMethod | null,
  ): Promise<ExpenseResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: before.id },
        data: { status: paidOn ? 'PAID' : 'PENDING', paidOn, paymentMethod: method },
        include: { supplier: true },
      });
      const response = ExpenseResponseDto.from(updated);
      await this.audit.record(
        {
          action: paidOn ? 'expenses.marked_paid' : 'expenses.marked_pending',
          entityType: ENTITY_TYPE,
          entityId: before.id,
          before: { status: before.status, paid_on: before.paidOn },
          after: { status: response.status, paid_on: response.paid_on },
        },
        tx,
      );
      return response;
    });
  }
}
