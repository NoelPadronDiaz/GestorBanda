/** Formato y conversión de importes, porcentajes y fechas (es-ES, euros). */

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  // es-ES no agrupa los miles en cifras de 4 dígitos («1500,00 €»); en contabilidad se espera «1.500,00 €».
  useGrouping: 'always',
});
const NUMBER_2 = new Intl.NumberFormat('es-ES', {
  useGrouping: 'always',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '—' : EUR.format(cents / 100);
}

/** 1234.5 € en un input de texto: admite «1.234,56», «1234,56» o «1234.56». */
export function parseEuros(value: string): number | null {
  let text = value.trim().replace(/\s|€/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function eurosToCents(value: string): number | null {
  const euros = parseEuros(value);
  return euros === null ? null : Math.round(euros * 100);
}

/** Céntimos → texto editable («1234,56»), sin símbolo ni separador de miles. */
export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export function amount(cents: number): string {
  return NUMBER_2.format(cents / 100);
}

export function percent(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;
}

/** 2026-03-01 → 01/03/2026 */
export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = [
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

/** 2026-03 → marzo 2026 */
export function period(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export function currentPeriod(): string {
  return today().slice(0, 7);
}
