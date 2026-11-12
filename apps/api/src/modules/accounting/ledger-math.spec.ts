import {
  closingLines,
  expenseAccrualLines,
  invoiceAccrualLines,
  lineErrors,
  openingLinesFromClosing,
  payrollAccrualLines,
  regularizationLines,
  settlementLines,
  totals,
} from './ledger-math';

describe('ledger-math', () => {
  it('proposes a balanced invoice entry and drops zero lines', () => {
    const lines = invoiceAccrualLines({
      baseCents: 140_187,
      taxCents: 9_813,
      withholdingCents: 0,
      totalCents: 150_000,
      incomeAccount: '705',
    });
    expect(lineErrors(lines)).toBeNull();
    expect(lines.map((line) => line.account_code)).toEqual(['430', '705', '477']);
  });

  it('records a withholding suffered on issued invoices', () => {
    const lines = invoiceAccrualLines({
      baseCents: 10_000,
      taxCents: 700,
      withholdingCents: 1_500,
      totalCents: 9_200,
      incomeAccount: '705',
    });
    expect(lineErrors(lines)).toBeNull();
    expect(lines.find((line) => line.account_code === '473')?.debit_cents).toBe(1_500);
  });

  it('books non-deductible IGIC as a higher expense', () => {
    const common = {
      category: 'PROFESSIONAL_SERVICES' as const,
      baseCents: 50_000,
      taxCents: 3_500,
      otherCents: 0,
      withholdingCents: 7_500,
      totalCents: 46_000,
    };
    const deductible = expenseAccrualLines({ ...common, igicDeductible: true });
    const nonDeductible = expenseAccrualLines({ ...common, igicDeductible: false });
    expect(lineErrors(deductible)).toBeNull();
    expect(lineErrors(nonDeductible)).toBeNull();
    expect(deductible.find((line) => line.account_code === '472')?.debit_cents).toBe(3_500);
    expect(nonDeductible.find((line) => line.account_code === '623')?.debit_cents).toBe(53_500);
    expect(nonDeductible.some((line) => line.account_code === '472')).toBe(false);
  });

  it('balances a payroll with every deduction', () => {
    const lines = payrollAccrualLines({
      grossCents: 120_000,
      employeeSsCents: 7_620,
      irpfCents: 9_600,
      otherDeductionsCents: 1_000,
      employerSsCents: 38_160,
      netCents: 101_780,
    });
    expect(lineErrors(lines)).toBeNull();
    expect(totals(lines).debit).toBe(158_160);
  });

  it('builds receipts and payments against cash or bank', () => {
    expect(settlementLines('RECEIPT', 500, '430', '572')[0]).toMatchObject({
      account_code: '572',
      debit_cents: 500,
    });
    expect(settlementLines('PAYMENT', 500, '400', '570')[1]).toMatchObject({
      account_code: '570',
      credit_cents: 500,
    });
  });

  it('rejects unbalanced or two-sided lines', () => {
    expect(
      lineErrors([
        { account_code: '572', description: null, debit_cents: 100, credit_cents: 0 },
        { account_code: '705', description: null, debit_cents: 0, credit_cents: 99 },
      ]),
    ).toBe('UNBALANCED');
    expect(
      lineErrors([
        { account_code: '572', description: null, debit_cents: 100, credit_cents: 100 },
        { account_code: '705', description: null, debit_cents: 0, credit_cents: 0 },
      ]),
    ).toBe('ONE_SIDE_PER_LINE');
  });

  it('regularizes income and expenses into 129 and closes/opens patrimony', () => {
    // Ingresos 1.000 € (acreedor) y gastos 600 € (deudor): excedente de 400 €.
    const { lines, surplusCents } = regularizationLines(
      new Map([
        ['705', -100_000],
        ['629', 60_000],
      ]),
    );
    expect(surplusCents).toBe(40_000);
    expect(lineErrors(lines)).toBeNull();
    expect(lines.find((line) => line.account_code === '129')?.credit_cents).toBe(40_000);

    const patrimony = new Map([
      ['572', 140_000],
      ['100', -100_000],
      ['129', -40_000],
    ]);
    const closing = closingLines(patrimony);
    expect(lineErrors(closing)).toBeNull();
    const opening = openingLinesFromClosing(closing);
    expect(opening.find((line) => line.account_code === '572')?.debit_cents).toBe(140_000);
  });
});
