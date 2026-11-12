import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsNumber, Matches, Max, Min } from 'class-validator';

/** Decoradores compuestos para los tipos de campo que se repiten en los módulos económicos. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Fecha sin hora, 'YYYY-MM-DD'. */
export const IsDateOnly = () =>
  applyDecorators(
    IsISO8601({ strict: true }),
    Matches(DATE_RE, { message: '$property must be YYYY-MM-DD' }),
  );

/** Mes, 'YYYY-MM'. */
export const IsPeriod = () => Matches(PERIOD_RE, { message: '$property must be YYYY-MM' });

/** Importe en céntimos (entero, por defecto no negativo). */
export const IsCents = (options: { allowNegative?: boolean; required?: boolean } = {}) =>
  applyDecorators(
    options.required === false
      ? ApiPropertyOptional({ type: 'integer', description: 'Céntimos de euro' })
      : ApiProperty({ type: 'integer', description: 'Céntimos de euro' }),
    IsInt(),
    ...(options.allowNegative ? [] : [Min(0)]),
    Max(Number.MAX_SAFE_INTEGER),
  );

/** Porcentaje con como mucho dos decimales (7, 7.5, 15). */
export const IsPercent = () => applyDecorators(IsNumber({ maxDecimalPlaces: 2 }), Min(0), Max(100));

export const IsYear = () => applyDecorators(IsInt(), Min(2000), Max(2100));
