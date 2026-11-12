import { describe, expect, it } from 'vitest';
import { baseFromGross, invoiceTotals } from '@alcaravan/shared';
import { parseBankDate, parseCsv } from './csv';
import { eurosToCents, money } from './format';

describe('format', () => {
  it('parses Spanish and plain euro inputs to cents', () => {
    expect(eurosToCents('1.234,56')).toBe(123456);
    expect(eurosToCents('1234,5')).toBe(123450);
    expect(eurosToCents('1234.56')).toBe(123456);
    expect(eurosToCents('')).toBeNull();
    expect(eurosToCents('abc')).toBeNull();
  });

  it('formats euros', () => {
    expect(money(150000).replace(/\s/g, ' ')).toMatch(/1\.500,00/);
  });

  it('finds the base that gives an exact gross total with 7 % IGIC', () => {
    const { base_cents, exact } = baseFromGross(150000, 700);
    expect(exact).toBe(true);
    expect(invoiceTotals([{ quantity: 1, unit_price: base_cents / 100 }], 700, 0).total_cents).toBe(
      150000,
    );
  });
});

describe('csv', () => {
  it('parses semicolon CSVs with quotes', () => {
    expect(parseCsv('Fecha;Concepto;Importe\n01/03/2026;"Pago; cuota";-35,00\n')).toEqual([
      ['Fecha', 'Concepto', 'Importe'],
      ['01/03/2026', 'Pago; cuota', '-35,00'],
    ]);
  });

  it('parses bank dates and rejects impossible ones', () => {
    expect(parseBankDate('01/03/2026')).toBe('2026-03-01');
    expect(parseBankDate('2026-03-01')).toBe('2026-03-01');
    expect(parseBankDate('31/02/2026')).toBeNull();
  });
});
