import { Injectable } from '@nestjs/common';
import { quarterRange } from '@alcaravan/shared';
import { dateOnly, parseDate } from '../../common/utils/dates';
import { bpToPercent, toNumber } from '../../common/utils/money';
import { ExpensesService } from '../billing/expenses.service';
import { InvoicesService } from '../billing/invoices.service';
import { PayrollService } from '../payroll/payroll.service';
import type {
  IgicRateSummaryDto,
  IgicReportDto,
  IgicRowDto,
  QuarterQueryDto,
  WithholdingsReportDto,
} from './tax.dto';

function byRate(rows: IgicRowDto[]): IgicRateSummaryDto[] {
  const map = new Map<number, IgicRateSummaryDto>();
  for (const row of rows) {
    const current = map.get(row.tax_rate) ?? {
      tax_rate: row.tax_rate,
      base_cents: 0,
      tax_cents: 0,
    };
    current.base_cents += row.base_cents;
    current.tax_cents += row.tax_cents;
    map.set(row.tax_rate, current);
  }
  return [...map.values()].sort((a, b) => a.tax_rate - b.tax_rate);
}

const sum = <T>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((acc, row) => acc + pick(row), 0);

/** Informes fiscales de apoyo, calculados a partir de facturas, gastos y nóminas (solo lectura). */
@Injectable()
export class TaxService {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly expenses: ExpensesService,
    private readonly payroll: PayrollService,
  ) {}

  async igic(query: QuarterQueryDto): Promise<IgicReportDto> {
    const { from, to } = quarterRange(query.year, query.quarter);
    const [issuedRows, receivedRows] = await Promise.all([
      this.invoices.listIssuedBetween(parseDate(from), parseDate(to)),
      this.expenses.listIssuedBetween(parseDate(from), parseDate(to)),
    ]);
    const issued: IgicRowDto[] = issuedRows.map((invoice) => ({
      date: dateOnly(invoice.issueDate),
      number: invoice.code,
      party_name: invoice.recipientName,
      party_tax_id: invoice.recipientTaxId,
      activity: invoice.series,
      base_cents: toNumber(invoice.baseCents),
      tax_rate: bpToPercent(invoice.taxRateBp),
      tax_cents: toNumber(invoice.taxCents),
    }));
    const received: IgicRowDto[] = receivedRows.map((expense) => ({
      date: dateOnly(expense.issueDate),
      number: expense.number,
      party_name: expense.supplier.name,
      party_tax_id: expense.supplier.taxId,
      activity: expense.activity,
      base_cents: toNumber(expense.baseCents),
      tax_rate: bpToPercent(expense.taxRateBp),
      tax_cents: toNumber(expense.taxCents),
    }));
    const output = sum(issued, (row) => row.tax_cents);
    const input = sum(received, (row) => row.tax_cents);
    return {
      year: query.year,
      quarter: query.quarter,
      from,
      to,
      issued,
      received,
      issued_by_rate: byRate(issued),
      received_by_rate: byRate(received),
      output_tax_cents: output,
      input_tax_cents: input,
      difference_cents: output - input,
    };
  }

  async withholdings(query: QuarterQueryDto): Promise<WithholdingsReportDto> {
    const { from, to } = quarterRange(query.year, query.quarter);
    const [expenses, payrolls] = await Promise.all([
      this.expenses.listWithholdingsPaidBetween(parseDate(from), parseDate(to)),
      this.payroll.listWithholdingsPaidBetween(parseDate(from), parseDate(to)),
    ]);
    const professionals = expenses.map((expense) => ({
      paid_on: dateOnly(expense.paidOn)!,
      party_name: expense.supplier.name,
      party_tax_id: expense.supplier.taxId,
      reference: expense.number,
      base_cents: toNumber(expense.baseCents),
      withholding_rate: bpToPercent(expense.withholdingRateBp),
      withholding_cents: toNumber(expense.withholdingCents),
    }));
    const employees = payrolls.map((payroll) => ({
      paid_on: dateOnly(payroll.paidOn)!,
      party_name: payroll.worker.fullName,
      party_tax_id: null,
      reference: `Nómina ${payroll.period.toISOString().slice(0, 7)}`,
      base_cents: toNumber(payroll.grossCents),
      withholding_rate: null,
      withholding_cents: toNumber(payroll.irpfCents),
    }));
    const professionalsTotal = sum(professionals, (row) => row.withholding_cents);
    const employeesTotal = sum(employees, (row) => row.withholding_cents);
    return {
      year: query.year,
      quarter: query.quarter,
      professionals,
      employees,
      professionals_total_cents: professionalsTotal,
      employees_total_cents: employeesTotal,
      total_cents: professionalsTotal + employeesTotal,
    };
  }
}
