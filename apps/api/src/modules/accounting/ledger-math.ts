import type { ExpenseCategory } from '@prisma/client';

/**
 * Lógica contable pura (sin BD): propuestas de asiento, cuadre, regularización y cierre.
 * Todos los importes en céntimos enteros.
 */

export interface DraftLine {
  account_code: string;
  description: string | null;
  debit_cents: number;
  credit_cents: number;
}

/** Cuentas que usan las propuestas automáticas (todas existen en el plan de cuentas inicial). */
export const ACCOUNTS = {
  equityFund: '100',
  result: '129',
  suppliers: '400',
  clients: '430',
  pendingSalaries: '465',
  igicInput: '472',
  withholdingsSuffered: '473',
  withholdingsPayable: '4751',
  otherPayrollDeductions: '4759',
  socialSecurity: '476',
  igicOutput: '477',
  cash: '570',
  bank: '572',
  services: '705',
  userFees: '721',
  otherServices: '629',
  salaries: '640',
  employerSocialSecurity: '642',
} as const;

/** Cuenta de gasto propuesta por categoría (revisable antes de contabilizar). */
export const EXPENSE_CATEGORY_ACCOUNT: Record<ExpenseCategory, string> = {
  PROFESSIONAL_SERVICES: '623',
  TEACHING_REINFORCEMENT: '623',
  MATERIALS_INSTRUMENTS: '602',
  SUPPLIES: '628',
  RENT: '621',
  INSURANCE: '625',
  OTHER: ACCOUNTS.otherServices,
};

const debit = (account: string, description: string, cents: number): DraftLine => ({
  account_code: account,
  description,
  debit_cents: cents,
  credit_cents: 0,
});

const credit = (account: string, description: string, cents: number): DraftLine => ({
  account_code: account,
  description,
  debit_cents: 0,
  credit_cents: cents,
});

/** Quita las líneas a cero (p. ej. IGIC 0 %) que el CHECK de la BD no admitiría. */
function nonZero(lines: DraftLine[]): DraftLine[] {
  return lines.filter((line) => line.debit_cents > 0 || line.credit_cents > 0);
}

export function totals(lines: readonly DraftLine[]): { debit: number; credit: number } {
  return lines.reduce(
    (acc, line) => ({
      debit: acc.debit + line.debit_cents,
      credit: acc.credit + line.credit_cents,
    }),
    { debit: 0, credit: 0 },
  );
}

/** Motivo por el que un asiento no es válido, o null si lo es. */
export function lineErrors(lines: readonly DraftLine[]): string | null {
  if (lines.length < 2) return 'AT_LEAST_TWO_LINES';
  for (const line of lines) {
    if (line.debit_cents < 0 || line.credit_cents < 0) return 'NEGATIVE_AMOUNT';
    if (line.debit_cents > 0 === line.credit_cents > 0) return 'ONE_SIDE_PER_LINE';
  }
  const sum = totals(lines);
  if (sum.debit !== sum.credit) return 'UNBALANCED';
  return null;
}

// ── Propuestas desde documentos ──

export function invoiceAccrualLines(invoice: {
  baseCents: number;
  taxCents: number;
  withholdingCents: number;
  totalCents: number;
  /** 721 para cuotas de la escuela, 705 para el resto. */
  incomeAccount: string;
}): DraftLine[] {
  return nonZero([
    debit(ACCOUNTS.clients, 'Cliente', invoice.totalCents),
    debit(ACCOUNTS.withholdingsSuffered, 'Retención soportada', invoice.withholdingCents),
    credit(invoice.incomeAccount, 'Ingreso', invoice.baseCents),
    credit(ACCOUNTS.igicOutput, 'IGIC repercutido', invoice.taxCents),
  ]);
}

export function expenseAccrualLines(expense: {
  category: ExpenseCategory;
  baseCents: number;
  taxCents: number;
  otherCents: number;
  withholdingCents: number;
  totalCents: number;
  /** IGIC deducible → 472; no deducible → mayor gasto en la cuenta del gasto. */
  igicDeductible: boolean;
}): DraftLine[] {
  const expenseAccount = EXPENSE_CATEGORY_ACCOUNT[expense.category];
  const lines: DraftLine[] = [
    debit(
      expenseAccount,
      'Gasto',
      expense.baseCents + (expense.igicDeductible ? 0 : expense.taxCents),
    ),
  ];
  if (expense.igicDeductible)
    lines.push(debit(ACCOUNTS.igicInput, 'IGIC soportado', expense.taxCents));
  if (expense.otherCents > 0) {
    lines.push(debit(ACCOUNTS.otherServices, 'Otros cargos', expense.otherCents));
  } else if (expense.otherCents < 0) {
    lines.push(credit(ACCOUNTS.otherServices, 'Otros abonos', -expense.otherCents));
  }
  lines.push(credit(ACCOUNTS.withholdingsPayable, 'IRPF retenido', expense.withholdingCents));
  lines.push(credit(ACCOUNTS.suppliers, 'Proveedor', expense.totalCents));
  return nonZero(lines);
}

export function payrollAccrualLines(payroll: {
  grossCents: number;
  employeeSsCents: number;
  irpfCents: number;
  otherDeductionsCents: number;
  employerSsCents: number;
  netCents: number;
}): DraftLine[] {
  return nonZero([
    debit(ACCOUNTS.salaries, 'Sueldos y salarios', payroll.grossCents),
    debit(ACCOUNTS.employerSocialSecurity, 'Seguridad Social empresa', payroll.employerSsCents),
    credit(ACCOUNTS.pendingSalaries, 'Neto pendiente de pago', payroll.netCents),
    credit(
      ACCOUNTS.socialSecurity,
      'Seguridad Social',
      payroll.employeeSsCents + payroll.employerSsCents,
    ),
    credit(ACCOUNTS.withholdingsPayable, 'Retenciones IRPF', payroll.irpfCents),
    credit(ACCOUNTS.otherPayrollDeductions, 'Otras deducciones', payroll.otherDeductionsCents),
  ]);
}

/** Cobro (entra dinero contra la cuenta deudora) o pago (sale contra la acreedora). */
export function settlementLines(
  kind: 'RECEIPT' | 'PAYMENT',
  amountCents: number,
  counterpartAccount: string,
  cashAccount: string,
): DraftLine[] {
  const cashLabel = cashAccount === ACCOUNTS.cash ? 'Caja' : 'Banco';
  return kind === 'RECEIPT'
    ? [debit(cashAccount, cashLabel, amountCents), credit(counterpartAccount, 'Cobro', amountCents)]
    : [debit(counterpartAccount, 'Pago', amountCents), credit(cashAccount, cashLabel, amountCents)];
}

export function reversalLines(lines: readonly DraftLine[]): DraftLine[] {
  return lines.map((line) => ({
    ...line,
    debit_cents: line.credit_cents,
    credit_cents: line.debit_cents,
  }));
}

// ── Cierre del ejercicio ──

/** Saldo neto por cuenta: positivo = deudor, negativo = acreedor. */
export type NetBalances = Map<string, number>;

export function isResultAccount(code: string): boolean {
  return code.startsWith('6') || code.startsWith('7');
}

export function isPatrimonialAccount(code: string): boolean {
  return /^[1-5]/.test(code);
}

/**
 * Regularización: salda las cuentas 6 y 7 contra la 129. Devuelve también el excedente
 * (positivo = beneficio, que queda como saldo acreedor en la 129).
 */
export function regularizationLines(results: NetBalances): {
  lines: DraftLine[];
  surplusCents: number;
} {
  const lines: DraftLine[] = [];
  let net = 0;
  for (const [code, balance] of [...results.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!balance || !isResultAccount(code)) continue;
    net += balance;
    lines.push(
      balance > 0
        ? credit(code, 'Regularización', balance)
        : debit(code, 'Regularización', -balance),
    );
  }
  // net > 0 = más gastos que ingresos (pérdida) → la 129 queda deudora.
  if (net > 0) lines.push(debit(ACCOUNTS.result, 'Excedente del ejercicio', net));
  if (net < 0) lines.push(credit(ACCOUNTS.result, 'Excedente del ejercicio', -net));
  return { lines, surplusCents: -net };
}

/** Asiento de cierre: deja a cero todas las cuentas patrimoniales con saldo. */
export function closingLines(patrimony: NetBalances): DraftLine[] {
  return [...patrimony.entries()]
    .filter(([code, balance]) => balance !== 0 && isPatrimonialAccount(code))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, balance]) =>
      balance > 0 ? credit(code, 'Cierre', balance) : debit(code, 'Cierre', -balance),
    );
}

/** Asiento de apertura del ejercicio siguiente: el inverso exacto del cierre. */
export function openingLinesFromClosing(closing: readonly DraftLine[]): DraftLine[] {
  return reversalLines(closing).map((line) => ({ ...line, description: 'Apertura' }));
}

// ── Balance de situación ──

export type BalanceGroup = 'ASSET' | 'LIABILITY' | 'EQUITY';

/**
 * Clasificación simplificada por grupo del PGC. Las cuentas de los grupos 4 y 5 se clasifican por
 * el signo del saldo (p. ej. una 572 en descubierto es pasivo).
 */
export function balanceGroup(code: string, net: number): BalanceGroup {
  if (/^1[0-3]/.test(code)) return 'EQUITY';
  if (code.startsWith('1')) return 'LIABILITY';
  if (code.startsWith('2') || code.startsWith('3')) return 'ASSET';
  return net >= 0 ? 'ASSET' : 'LIABILITY';
}
