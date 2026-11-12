/** Las columnas DATE se manejan siempre en UTC: 2026-03-01 ↔ 2026-03-01T00:00:00.000Z. */

export function dateOnly(date: Date): string;
export function dateOnly(date: Date | null): string | null;
export function dateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function parseDate(value: string): Date;
export function parseDate(value: string | null | undefined): Date | null | undefined;
export function parseDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined || value === null
    ? value
    : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** 'YYYY-MM' → primer día del mes. */
export function monthStart(period: string): Date {
  return new Date(`${period}-01T00:00:00.000Z`);
}

/** Primer día del mes → 'YYYY-MM'. */
export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function lastDayOfMonth(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0));
}

export function todayUtc(): Date {
  return parseDate(new Date().toISOString().slice(0, 10));
}

export function yearRange(year: number): { gte: Date; lte: Date } {
  return { gte: parseDate(`${year}-01-01`), lte: parseDate(`${year}-12-31`) };
}

/** Suma meses respetando el último día (31-ene + 1 mes = 28/29-feb). */
export function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** '2026-03' → 'marzo de 2026' (texto que figura en las facturas de cuotas). */
export function monthLabelEs(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTHS_ES[month - 1]} de ${year}`;
}
