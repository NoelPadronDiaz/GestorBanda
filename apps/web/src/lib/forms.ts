import { z } from 'zod';
import { eurosToCents, parseEuros } from './format';

/** Utilidades de formulario: los inputs devuelven texto y la API quiere null, céntimos o números. */

export const nullable = (value: string | null | undefined): string | null => value?.trim() || null;

/** Importe en euros escrito a mano («1.234,56»); vacío permitido si `optional`. */
export const zEuros = (
  options: { optional?: boolean; allowNegative?: boolean; positive?: boolean } = {},
) =>
  z.string().refine((value) => {
    if (!value.trim()) return Boolean(options.optional);
    const cents = eurosToCents(value);
    if (cents === null) return false;
    if (options.positive) return cents > 0;
    return options.allowNegative || cents >= 0;
  }, 'validation.amount');

export const zPercent = () =>
  z.string().refine((value) => {
    const parsed = parseEuros(value || '0');
    return (
      parsed !== null &&
      parsed >= 0 &&
      parsed <= 100 &&
      Math.abs(parsed * 100 - Math.round(parsed * 100)) < 1e-6
    );
  }, 'validation.percent');

export const cents = (value: string): number => eurosToCents(value) ?? 0;
export const centsOrNull = (value: string): number | null =>
  value.trim() ? eurosToCents(value) : null;
export const pct = (value: string): number => parseEuros(value || '0') ?? 0;
