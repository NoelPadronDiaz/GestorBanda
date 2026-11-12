/**
 * Cálculos monetarios compartidos por la API (fuente de verdad) y la web (vista previa en formularios).
 * Todo el dinero va en céntimos enteros; los porcentajes en puntos básicos (7 % = 700 bp).
 */

/** Actividad económica de la asociación: Banda (serie ALC), Escuela (serie ESC) o gasto compartido. */
export const ACTIVITIES = ['BAND', 'SCHOOL', 'SHARED'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Series de facturación emitida. Cada serie numera por año: ALC-2026-001, ESC-2026-001... */
export const INVOICE_SERIES = ['ALC', 'ESC'] as const;
export type InvoiceSeriesCode = (typeof INVOICE_SERIES)[number];

export const SERIES_ACTIVITY: Record<InvoiceSeriesCode, Activity> = { ALC: 'BAND', ESC: 'SCHOOL' };

/** Tipo general del IGIC; valor por defecto de facturas y cuotas de la escuela. */
export const DEFAULT_IGIC_BP = 700;

/** Redondeo half-up simétrico (como en una calculadora), sin sesgo para importes negativos. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** 7.5 → 750. Admite como mucho dos decimales (lo valida quien llama). */
export function percentToBp(percent: number): number {
  return roundHalfUp(percent * 100);
}

export function bpToPercent(bp: number): number {
  return bp / 100;
}

/** Cuota de un porcentaje sobre una base en céntimos. */
export function applyRate(baseCents: number, rateBp: number): number {
  return roundHalfUp((baseCents * rateBp) / 10_000);
}

/** Importe de una línea: cantidad × precio unitario (en euros, hasta 4 decimales) → céntimos. */
export function lineAmountCents(quantity: number, unitPrice: number): number {
  // toFixed evita que 0.07 × 100 = 7.000000000000001 cambie el redondeo.
  return roundHalfUp(Number((quantity * unitPrice * 100).toFixed(6)));
}

export interface InvoiceTotals {
  base_cents: number;
  tax_cents: number;
  withholding_cents: number;
  total_cents: number;
}

export function invoiceTotals(
  lines: readonly { quantity: number; unit_price: number }[],
  taxRateBp: number,
  withholdingRateBp: number,
): InvoiceTotals {
  const base = lines.reduce(
    (sum, line) => sum + lineAmountCents(line.quantity, line.unit_price),
    0,
  );
  const tax = applyRate(base, taxRateBp);
  const withholding = applyRate(base, withholdingRateBp);
  return {
    base_cents: base,
    tax_cents: tax,
    withholding_cents: withholding,
    total_cents: base + tax - withholding,
  };
}

/**
 * Base imponible que, con el IGIC y la retención indicados, da exactamente `grossCents` de total.
 * Si por redondeo no existe una base exacta, devuelve la más cercana y `exact = false`.
 * Se usa en las cuotas de la escuela (importe con IGIC incluido) y en el modo «importe final».
 */
export function baseFromGross(
  grossCents: number,
  taxRateBp: number,
  withholdingRateBp = 0,
): { base_cents: number; exact: boolean } {
  const factor = 1 + (taxRateBp - withholdingRateBp) / 10_000;
  if (factor <= 0) throw new RangeError('Invalid rates: total factor must be positive');
  const estimate = Math.round(grossCents / factor);
  let best = { base_cents: estimate, diff: Number.POSITIVE_INFINITY };
  for (let delta = -8; delta <= 8; delta += 1) {
    const base = estimate + delta;
    if (base < 0) continue;
    const total = base + applyRate(base, taxRateBp) - applyRate(base, withholdingRateBp);
    const diff = Math.abs(total - grossCents);
    if (diff < best.diff) best = { base_cents: base, diff };
    if (diff === 0) break;
  }
  return { base_cents: best.base_cents, exact: best.diff === 0 };
}

/** Trimestre natural (1-4) y rango de fechas ISO (YYYY-MM-DD, ambos incluidos). */
export function quarterRange(year: number, quarter: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { from: `${year}-${pad(startMonth)}-01`, to: `${year}-${pad(endMonth)}-${pad(lastDay)}` };
}
