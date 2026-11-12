import { Injectable } from '@nestjs/common';
import type { Activity, JournalSourceType, PaymentMethod, Prisma } from '@prisma/client';
import { paginationMeta, skipTake } from '../../common/dto/pagination.dto';
import { conflict, invalidField, notFound } from '../../common/errors/domain-errors';
import { dateOnly, parseDate, todayUtc, yearRange } from '../../common/utils/dates';
import { toBigInt, toNumber } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ExpensesService } from '../billing/expenses.service';
import { InvoicesService } from '../billing/invoices.service';
import { PayrollService } from '../payroll/payroll.service';
import {
  AccountResponseDto,
  type BalanceSheetDto,
  type CreateAccountDto,
  EntryResponseDto,
  type IncomeStatementDto,
  type LedgerQueryDto,
  type LedgerResponseDto,
  type ListEntriesQueryDto,
  type PaginatedEntriesDto,
  type PendingDocumentDto,
  type PostEntryDto,
  type ProposalQueryDto,
  type ProposalResponseDto,
  type ReportLineDto,
  type ReportQueryDto,
  type TrialBalanceRowDto,
} from './accounting.dto';
import {
  ACCOUNTS,
  balanceGroup,
  type DraftLine,
  expenseAccrualLines,
  invoiceAccrualLines,
  lineErrors,
  payrollAccrualLines,
  reversalLines,
  settlementLines,
} from './ledger-math';

const ENTITY_TYPE = 'JOURNAL_ENTRY';
const ENTRY_INCLUDE = {
  lines: { include: { account: true } },
  reversedBy: { select: { id: true } },
} as const;
/** Asientos técnicos que no cuentan como actividad del ejercicio en los informes de resultados. */
const CLOSING_SOURCES: JournalSourceType[] = ['REGULARIZATION', 'CLOSING'];

export interface PostInput {
  entryDate: Date;
  activity: Activity;
  reference: string;
  concept: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  reversalOfId?: string | null;
  lines: DraftLine[];
}

type NetMap = Map<string, { debit: number; credit: number }>;

const cashAccountOf = (lines: readonly { account_code: string }[]): PaymentMethod =>
  lines.some((line) => line.account_code.startsWith(ACCOUNTS.cash)) ? 'CASH' : 'BANK_TRANSFER';

/**
 * Libro diario: propietario de ledger_account, fiscal_year, journal_entry y journal_line.
 * Los asientos nunca se modifican; enlazar o desenlazar documentos de origen se hace en la misma
 * transacción a través de los servicios propietarios de esos documentos.
 */
@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly expenses: ExpensesService,
    private readonly payroll: PayrollService,
  ) {}

  // ── Plan de cuentas ──

  async listAccounts(): Promise<AccountResponseDto[]> {
    const rows = await this.prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
    return rows.map((row) => AccountResponseDto.from(row));
  }

  async createAccount(dto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ledgerAccount.create({
        data: { code: dto.code, name: dto.name.trim() },
      });
      const response = AccountResponseDto.from(created);
      await this.audit.record(
        {
          action: 'ledger_accounts.created',
          entityType: 'LEDGER_ACCOUNT',
          entityId: dto.code,
          after: response,
        },
        tx,
      );
      return response;
    });
  }

  // ── Diario ──

  async list(query: ListEntriesQueryDto): Promise<PaginatedEntriesDto> {
    const where: Prisma.JournalEntryWhereInput = {
      year: query.year,
      activity: query.activity,
      sourceType: query.source_type,
      ...(query.account ? { lines: { some: { accountCode: { startsWith: query.account } } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: ENTRY_INCLUDE,
        orderBy: [{ entryDate: 'desc' }, { sequence: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return {
      data: rows.map((row) => EntryResponseDto.from(row)),
      meta: paginationMeta(query, total),
    };
  }

  /**
   * Cola de contabilización: documentos del ejercicio sin asiento de devengo y cobros/pagos
   * marcados como hechos cuyo asiento de tesorería falta. Solo lectura.
   */
  async pending(year: number): Promise<PendingDocumentDto[]> {
    const range = yearRange(year);
    const [invoices, invoicePayments, expenses, expensePayments, payrolls, payrollPayments] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: { issueDate: range, journalEntryId: null, status: { not: 'CANCELLED' } },
        }),
        this.prisma.invoice.findMany({
          where: {
            paidOn: range,
            status: 'PAID',
            journalEntryId: { not: null },
            paymentEntryId: null,
          },
        }),
        this.prisma.expense.findMany({
          where: { issueDate: range, journalEntryId: null },
          include: { supplier: true },
        }),
        this.prisma.expense.findMany({
          where: {
            paidOn: range,
            status: 'PAID',
            journalEntryId: { not: null },
            paymentEntryId: null,
          },
          include: { supplier: true },
        }),
        this.prisma.payroll.findMany({
          where: { accrualDate: range, journalEntryId: null },
          include: { worker: true },
        }),
        this.prisma.payroll.findMany({
          where: {
            paidOn: range,
            status: 'PAID',
            journalEntryId: { not: null },
            paymentEntryId: null,
          },
          include: { worker: true },
        }),
      ]);
    const period = (d: Date) => dateOnly(d)!.slice(0, 7);
    const rows: PendingDocumentDto[] = [
      ...invoices.map((i) => ({
        source_type: 'INVOICE' as const,
        source_id: i.id,
        date: dateOnly(i.issueDate)!,
        label: `${i.code} · ${i.recipientName}`,
        activity: i.series === 'ESC' ? ('SCHOOL' as const) : ('BAND' as const),
        amount_cents: toNumber(i.totalCents),
        has_input_tax: false,
      })),
      ...invoicePayments.map((i) => ({
        source_type: 'INVOICE_PAYMENT' as const,
        source_id: i.id,
        date: dateOnly(i.paidOn)!,
        label: `${i.code} · ${i.recipientName}`,
        activity: i.series === 'ESC' ? ('SCHOOL' as const) : ('BAND' as const),
        amount_cents: toNumber(i.totalCents),
        has_input_tax: false,
      })),
      ...expenses.map((e) => ({
        source_type: 'EXPENSE' as const,
        source_id: e.id,
        date: dateOnly(e.issueDate)!,
        label: `${e.supplier.name} · ${e.number}`,
        activity: e.activity,
        amount_cents: toNumber(e.totalCents),
        has_input_tax: toNumber(e.taxCents) > 0,
      })),
      ...expensePayments.map((e) => ({
        source_type: 'EXPENSE_PAYMENT' as const,
        source_id: e.id,
        date: dateOnly(e.paidOn)!,
        label: `${e.supplier.name} · ${e.number}`,
        activity: e.activity,
        amount_cents: toNumber(e.totalCents),
        has_input_tax: false,
      })),
      ...payrolls.map((p) => ({
        source_type: 'PAYROLL' as const,
        source_id: p.id,
        date: dateOnly(p.accrualDate)!,
        label: `${p.worker.fullName} · ${period(p.period)}`,
        activity: p.activity,
        amount_cents: toNumber(p.grossCents),
        has_input_tax: false,
      })),
      ...payrollPayments.map((p) => ({
        source_type: 'PAYROLL_PAYMENT' as const,
        source_id: p.id,
        date: dateOnly(p.paidOn)!,
        label: `${p.worker.fullName} · ${period(p.period)}`,
        activity: p.activity,
        amount_cents: toNumber(p.netCents),
        has_input_tax: false,
      })),
    ];
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  }

  async findOneOrFail(id: string): Promise<EntryResponseDto> {
    const row = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: ENTRY_INCLUDE,
    });
    if (!row) throw notFound('Journal entry');
    return EntryResponseDto.from(row);
  }

  /** Propuesta editable a partir de un documento. No guarda nada. */
  async proposal(query: ProposalQueryDto): Promise<ProposalResponseDto> {
    const via = query.via === 'CASH' ? ACCOUNTS.cash : ACCOUNTS.bank;
    const warnings: string[] = [];
    const base = { source_type: query.source_type, source_id: query.source_id, warnings };
    const settlementDate = (paidOn: Date | null) =>
      query.date ?? (paidOn ?? todayUtc()).toISOString().slice(0, 10);

    switch (query.source_type) {
      case 'INVOICE':
      case 'INVOICE_PAYMENT': {
        const invoice = await this.invoices.findRowOrFail(query.source_id);
        const activity = invoice.series === 'ESC' ? 'SCHOOL' : 'BAND';
        if (query.source_type === 'INVOICE') {
          if (invoice.withholdingCents > 0n) warnings.push('CHECK_WITHHOLDING_ACCOUNT');
          return {
            ...base,
            entry_date: invoice.issueDate.toISOString().slice(0, 10),
            activity,
            reference: invoice.code,
            concept: `Factura emitida ${invoice.code} · ${invoice.recipientName}`,
            lines: invoiceAccrualLines({
              baseCents: toNumber(invoice.baseCents),
              taxCents: toNumber(invoice.taxCents),
              withholdingCents: toNumber(invoice.withholdingCents),
              totalCents: toNumber(invoice.totalCents),
              incomeAccount: invoice.studentFee ? ACCOUNTS.userFees : ACCOUNTS.services,
            }),
          };
        }
        return {
          ...base,
          entry_date: settlementDate(invoice.paidOn),
          activity,
          reference: invoice.code,
          concept: `Cobro factura ${invoice.code} · ${invoice.recipientName}`,
          lines: settlementLines('RECEIPT', toNumber(invoice.totalCents), ACCOUNTS.clients, via),
        };
      }
      case 'EXPENSE':
      case 'EXPENSE_PAYMENT': {
        const expense = await this.expenses.findRowOrFail(query.source_id);
        if (query.source_type === 'EXPENSE') {
          if (expense.taxCents > 0n && query.igic_deductible === undefined) {
            throw invalidField('igic_deductible', 'Choose whether the input IGIC is deductible');
          }
          warnings.push('CHECK_EXPENSE_ACCOUNT');
          return {
            ...base,
            entry_date: expense.issueDate.toISOString().slice(0, 10),
            activity: expense.activity,
            reference: expense.number,
            concept: `Factura recibida ${expense.number} · ${expense.supplier.name}`,
            lines: expenseAccrualLines({
              category: expense.category,
              baseCents: toNumber(expense.baseCents),
              taxCents: toNumber(expense.taxCents),
              otherCents: toNumber(expense.otherCents),
              withholdingCents: toNumber(expense.withholdingCents),
              totalCents: toNumber(expense.totalCents),
              igicDeductible: query.igic_deductible ?? true,
            }),
          };
        }
        return {
          ...base,
          entry_date: settlementDate(expense.paidOn),
          activity: expense.activity,
          reference: expense.number,
          concept: `Pago factura ${expense.number} · ${expense.supplier.name}`,
          lines: settlementLines('PAYMENT', toNumber(expense.totalCents), ACCOUNTS.suppliers, via),
        };
      }
      case 'PAYROLL':
      case 'PAYROLL_PAYMENT': {
        const payroll = await this.payroll.findPayrollOrFail(query.source_id);
        const period = payroll.period.toISOString().slice(0, 7);
        const reference = `NOM-${period}`;
        if (query.source_type === 'PAYROLL') {
          if (payroll.otherDeductionsCents > 0n) warnings.push('CHECK_OTHER_DEDUCTIONS_ACCOUNT');
          return {
            ...base,
            entry_date: payroll.accrualDate.toISOString().slice(0, 10),
            activity: payroll.activity,
            reference,
            concept: `Nómina ${period} · ${payroll.worker.fullName}`,
            lines: payrollAccrualLines({
              grossCents: toNumber(payroll.grossCents),
              employeeSsCents: toNumber(payroll.employeeSsCents),
              irpfCents: toNumber(payroll.irpfCents),
              otherDeductionsCents: toNumber(payroll.otherDeductionsCents),
              employerSsCents: toNumber(payroll.employerSsCents),
              netCents: toNumber(payroll.netCents),
            }),
          };
        }
        return {
          ...base,
          entry_date: settlementDate(payroll.paidOn),
          activity: payroll.activity,
          reference,
          concept: `Pago nómina ${period} · ${payroll.worker.fullName}`,
          lines: settlementLines(
            'PAYMENT',
            toNumber(payroll.netCents),
            ACCOUNTS.pendingSalaries,
            via,
          ),
        };
      }
    }
  }

  async post(dto: PostEntryDto, actor: AuthenticatedUser): Promise<EntryResponseDto> {
    const needsSource = dto.source_type !== 'MANUAL' && dto.source_type !== 'OPENING';
    if (needsSource && !dto.source_id) throw invalidField('source_id', 'source_id is required');
    if (!needsSource && dto.source_id) throw invalidField('source_id', 'source_id is not allowed');
    const entryDate = parseDate(dto.entry_date);

    const id = await this.prisma.$transaction(async (tx) => {
      const entryId = await this.postInTx(
        tx,
        {
          entryDate,
          activity: dto.activity,
          reference: dto.reference.trim(),
          concept: dto.concept.trim(),
          sourceType: dto.source_type,
          sourceId: dto.source_id ?? null,
          lines: dto.lines,
        },
        actor.id,
      );
      if (dto.source_id) {
        await this.linkSource(
          tx,
          dto.source_type,
          dto.source_id,
          entryId,
          entryDate,
          cashAccountOf(dto.lines),
        );
      }
      return entryId;
    });
    return this.findOneOrFail(id);
  }

  /** Crea un asiento inmutable. Lo usan también la reversión y el cierre del ejercicio. */
  async postInTx(
    tx: Prisma.TransactionClient,
    input: PostInput,
    actorId: string | null,
  ): Promise<string> {
    const error = lineErrors(input.lines);
    if (error) throw invalidField('lines', error);

    const codes = [...new Set(input.lines.map((line) => line.account_code))];
    const known = await tx.ledgerAccount.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const unknown = codes.filter((code) => !known.some((row) => row.code === code));
    if (unknown.length) {
      throw conflict('UNKNOWN_ACCOUNT', 'Some accounts are not in the chart of accounts', {
        accounts: unknown,
      });
    }

    const year = input.entryDate.getUTCFullYear();
    await this.lockOpenYear(tx, year);
    const sequence = await this.nextSequence(tx, year);

    const created = await tx.journalEntry.create({
      data: {
        year,
        sequence,
        entryDate: input.entryDate,
        activity: input.activity,
        reference: input.reference.slice(0, 80),
        concept: input.concept.slice(0, 300),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reversalOfId: input.reversalOfId ?? null,
        createdById: actorId,
        lines: {
          create: input.lines.map((line, index) => ({
            position: index + 1,
            accountCode: line.account_code,
            description: line.description?.trim() || null,
            debitCents: toBigInt(line.debit_cents),
            creditCents: toBigInt(line.credit_cents),
          })),
        },
      },
      include: ENTRY_INCLUDE,
    });
    await this.audit.record(
      {
        action: 'journal_entries.posted',
        entityType: ENTITY_TYPE,
        entityId: created.id,
        after: EntryResponseDto.from(created),
      },
      tx,
    );
    return created.id;
  }

  /** Corrige un asiento con otro de signo contrario y desvincula el documento de origen. */
  async reverse(id: string, actor: AuthenticatedUser): Promise<EntryResponseDto> {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: ENTRY_INCLUDE,
    });
    if (!original) throw notFound('Journal entry');
    if (original.sourceType === 'REVERSAL')
      throw conflict('IS_REVERSAL', 'A reversal cannot be reversed');
    if (original.reversedBy) throw conflict('ALREADY_REVERSED', 'Entry is already reversed');
    if (CLOSING_SOURCES.includes(original.sourceType)) {
      throw conflict('CLOSING_ENTRY', 'Closing entries cannot be reversed');
    }
    if (await this.prisma.bankMovement.count({ where: { journalEntryId: id } })) {
      throw conflict(
        'ENTRY_RECONCILED',
        'Unlink the bank movements reconciled with this entry first',
      );
    }

    const reversalId = await this.prisma.$transaction(async (tx) => {
      if (original.sourceId) await this.unlinkSource(tx, original.sourceType, original.sourceId);
      return this.postInTx(
        tx,
        {
          entryDate: original.entryDate,
          activity: original.activity,
          reference: `REV ${original.reference}`,
          concept: `Reversión de: ${original.concept}`,
          sourceType: 'REVERSAL',
          sourceId: original.sourceId,
          reversalOfId: original.id,
          lines: reversalLines(
            original.lines
              .sort((a, b) => a.position - b.position)
              .map((line) => ({
                account_code: line.accountCode,
                description: line.description,
                debit_cents: toNumber(line.debitCents),
                credit_cents: toNumber(line.creditCents),
              })),
          ),
        },
        actor.id,
      );
    });
    return this.findOneOrFail(reversalId);
  }

  // ── Informes ──

  async ledger(query: LedgerQueryDto): Promise<LedgerResponseDto> {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { code: query.account } });
    const range = yearRange(query.year);
    const [opening, lines] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: {
          accountCode: { startsWith: query.account },
          entry: { entryDate: { lt: range.gte } },
        },
        _sum: { debitCents: true, creditCents: true },
      }),
      this.prisma.journalLine.findMany({
        where: { accountCode: { startsWith: query.account }, entry: { entryDate: range } },
        include: { entry: true },
        orderBy: [
          { entry: { entryDate: 'asc' } },
          { entry: { sequence: 'asc' } },
          { position: 'asc' },
        ],
      }),
    ]);
    let balance = toNumber(opening._sum.debitCents) - toNumber(opening._sum.creditCents);
    const openingBalance = balance;
    const movements = lines.map((line) => {
      balance += toNumber(line.debitCents) - toNumber(line.creditCents);
      return {
        entry_id: line.entryId,
        entry_number: `${line.entry.year}/${line.entry.sequence}`,
        entry_date: line.entry.entryDate.toISOString().slice(0, 10),
        reference: line.entry.reference,
        concept: line.entry.concept,
        description: line.description,
        debit_cents: toNumber(line.debitCents),
        credit_cents: toNumber(line.creditCents),
        balance_cents: balance,
      };
    });
    return {
      account_code: query.account,
      account_name: account?.name ?? '',
      opening_balance_cents: openingBalance,
      movements,
      closing_balance_cents: balance,
    };
  }

  async trialBalance(query: ReportQueryDto): Promise<TrialBalanceRowDto[]> {
    const net = await this.netByAccount({
      entryDate: yearRange(query.year),
      activity: query.activity,
    });
    const names = await this.accountNames();
    return [...net.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, sums]) => ({
        account_code: code,
        account_name: names.get(code) ?? '',
        debit_cents: sums.debit,
        credit_cents: sums.credit,
        balance_cents: sums.debit - sums.credit,
      }));
  }

  async incomeStatement(query: ReportQueryDto): Promise<IncomeStatementDto> {
    const net = await this.netByAccount({
      entryDate: yearRange(query.year),
      activity: query.activity,
      sourceType: { notIn: CLOSING_SOURCES },
    });
    const names = await this.accountNames();
    const income: ReportLineDto[] = [];
    const expenses: ReportLineDto[] = [];
    for (const [code, sums] of [...net.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const line = { account_code: code, account_name: names.get(code) ?? '' };
      if (code.startsWith('7')) income.push({ ...line, amount_cents: sums.credit - sums.debit });
      if (code.startsWith('6')) expenses.push({ ...line, amount_cents: sums.debit - sums.credit });
    }
    const incomeTotal = income.reduce((sum, line) => sum + line.amount_cents, 0);
    const expensesTotal = expenses.reduce((sum, line) => sum + line.amount_cents, 0);
    return {
      year: query.year,
      activity: query.activity ?? null,
      income,
      expenses,
      income_total_cents: incomeTotal,
      expenses_total_cents: expensesTotal,
      result_cents: incomeTotal - expensesTotal,
    };
  }

  /** Balance de toda la asociación a 31/12 (sin el asiento de cierre de ese mismo año). */
  async balanceSheet(year: number): Promise<BalanceSheetDto> {
    const yearEnd = yearRange(year).lte;
    const net = await this.netByAccount({
      entryDate: { lte: yearEnd },
      NOT: { sourceType: 'CLOSING', year },
    });
    const names = await this.accountNames();
    const assets: ReportLineDto[] = [];
    const liabilities: ReportLineDto[] = [];
    const equity: ReportLineDto[] = [];
    let pendingResult = 0;
    for (const [code, sums] of [...net.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const balance = sums.debit - sums.credit;
      if (code.startsWith('6') || code.startsWith('7')) {
        pendingResult -= balance;
        continue;
      }
      if (!balance) continue;
      const line = { account_code: code, account_name: names.get(code) ?? '' };
      const group = balanceGroup(code, balance);
      if (group === 'ASSET') assets.push({ ...line, amount_cents: balance });
      if (group === 'LIABILITY') liabilities.push({ ...line, amount_cents: -balance });
      if (group === 'EQUITY') equity.push({ ...line, amount_cents: -balance });
    }
    const sum = (lines: ReportLineDto[]) => lines.reduce((acc, line) => acc + line.amount_cents, 0);
    const assetsTotal = sum(assets);
    const liabilitiesTotal = sum(liabilities);
    const equityTotal = sum(equity) + pendingResult;
    const difference = assetsTotal - liabilitiesTotal - equityTotal;

    const warnings: string[] = [];
    const [before, openings] = await Promise.all([
      this.prisma.journalEntry.count({ where: { entryDate: { lt: yearRange(year).gte } } }),
      this.prisma.journalEntry.count({ where: { year, sourceType: 'OPENING' } }),
    ]);
    if (!before && !openings) warnings.push('NO_OPENING_BALANCES');
    if (difference !== 0) warnings.push('UNBALANCED');
    return {
      year,
      assets,
      liabilities,
      equity,
      pending_result_cents: pendingResult,
      assets_total_cents: assetsTotal,
      liabilities_total_cents: liabilitiesTotal,
      equity_total_cents: equityTotal,
      difference_cents: difference,
      warnings,
    };
  }

  // ── Para otros servicios del módulo y para Tesorería / Presupuestos ──

  async netByAccount(
    entryWhere: Prisma.JournalEntryWhereInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<NetMap> {
    const groups = await tx.journalLine.groupBy({
      by: ['accountCode'],
      where: { entry: entryWhere },
      _sum: { debitCents: true, creditCents: true },
    });
    return new Map(
      groups.map((group) => [
        group.accountCode,
        { debit: toNumber(group._sum.debitCents), credit: toNumber(group._sum.creditCents) },
      ]),
    );
  }

  /** Saldo deudor (positivo) de las cuentas que empiezan por `prefix` hasta una fecha. */
  async balanceUntil(prefix: string, date: Date): Promise<number> {
    const sums = await this.prisma.journalLine.aggregate({
      where: { accountCode: { startsWith: prefix }, entry: { entryDate: { lte: date } } },
      _sum: { debitCents: true, creditCents: true },
    });
    return toNumber(sums._sum.debitCents) - toNumber(sums._sum.creditCents);
  }

  async lockOpenYear(tx: Prisma.TransactionClient, year: number): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "fiscal_year" ("year", "status", "updated_at")
      VALUES (${year}, 'OPEN', CURRENT_TIMESTAMP)
      ON CONFLICT ("year") DO NOTHING`;
    // El bloqueo de la fila serializa la numeración de asientos del ejercicio.
    const [row] = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "fiscal_year" WHERE "year" = ${year} FOR UPDATE`;
    if (row.status !== 'OPEN') throw conflict('YEAR_CLOSED', `Fiscal year ${year} is closed`);
  }

  private async nextSequence(tx: Prisma.TransactionClient, year: number): Promise<number> {
    const max = await tx.journalEntry.aggregate({ where: { year }, _max: { sequence: true } });
    return (max._max.sequence ?? 0) + 1;
  }

  private async accountNames(): Promise<Map<string, string>> {
    const rows = await this.prisma.ledgerAccount.findMany();
    return new Map(rows.map((row) => [row.code, row.name]));
  }

  private async linkSource(
    tx: Prisma.TransactionClient,
    type: JournalSourceType,
    sourceId: string,
    entryId: string,
    entryDate: Date,
    method: PaymentMethod,
  ): Promise<void> {
    const payment = { entryId, paidOn: entryDate, method };
    switch (type) {
      case 'INVOICE': {
        const invoice = await this.invoices.findRowOrFail(sourceId, tx);
        if (invoice.status === 'CANCELLED')
          throw conflict('INVOICE_CANCELLED', 'Invoice is cancelled');
        if (invoice.journalEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Invoice is already accounted');
        return this.invoices.linkAccrualEntry(tx, sourceId, entryId);
      }
      case 'INVOICE_PAYMENT': {
        const invoice = await this.invoices.findRowOrFail(sourceId, tx);
        if (!invoice.journalEntryId) throw conflict('ACCRUAL_FIRST', 'Account the invoice first');
        if (invoice.paymentEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Payment is already accounted');
        return this.invoices.linkPaymentEntry(tx, sourceId, payment);
      }
      case 'EXPENSE': {
        const expense = await this.expenses.findRowOrFail(sourceId, tx);
        if (expense.journalEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Expense is already accounted');
        return this.expenses.linkAccrualEntry(tx, sourceId, entryId);
      }
      case 'EXPENSE_PAYMENT': {
        const expense = await this.expenses.findRowOrFail(sourceId, tx);
        if (!expense.journalEntryId) throw conflict('ACCRUAL_FIRST', 'Account the expense first');
        if (expense.paymentEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Payment is already accounted');
        return this.expenses.linkPaymentEntry(tx, sourceId, payment);
      }
      case 'PAYROLL': {
        const payroll = await this.payroll.findPayrollOrFail(sourceId, tx);
        if (payroll.journalEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Payroll is already accounted');
        return this.payroll.linkAccrualEntry(tx, sourceId, entryId);
      }
      case 'PAYROLL_PAYMENT': {
        const payroll = await this.payroll.findPayrollOrFail(sourceId, tx);
        if (!payroll.journalEntryId) throw conflict('ACCRUAL_FIRST', 'Account the payroll first');
        if (payroll.paymentEntryId)
          throw conflict('ALREADY_ACCOUNTED', 'Payment is already accounted');
        return this.payroll.linkPaymentEntry(tx, sourceId, payment);
      }
      default:
        return;
    }
  }

  private async unlinkSource(
    tx: Prisma.TransactionClient,
    type: JournalSourceType,
    sourceId: string,
  ): Promise<void> {
    const paymentFirst = () =>
      conflict('REVERSE_PAYMENT_FIRST', 'Reverse the payment entry before the accrual entry');
    switch (type) {
      case 'INVOICE': {
        const invoice = await this.invoices.findRowOrFail(sourceId, tx);
        if (invoice.paymentEntryId) throw paymentFirst();
        return this.invoices.linkAccrualEntry(tx, sourceId, null);
      }
      case 'INVOICE_PAYMENT':
        return this.invoices.linkPaymentEntry(tx, sourceId, null);
      case 'EXPENSE': {
        const expense = await this.expenses.findRowOrFail(sourceId, tx);
        if (expense.paymentEntryId) throw paymentFirst();
        return this.expenses.linkAccrualEntry(tx, sourceId, null);
      }
      case 'EXPENSE_PAYMENT':
        return this.expenses.linkPaymentEntry(tx, sourceId, null);
      case 'PAYROLL': {
        const payroll = await this.payroll.findPayrollOrFail(sourceId, tx);
        if (payroll.paymentEntryId) throw paymentFirst();
        return this.payroll.linkAccrualEntry(tx, sourceId, null);
      }
      case 'PAYROLL_PAYMENT':
        return this.payroll.linkPaymentEntry(tx, sourceId, null);
      default:
        return;
    }
  }
}
