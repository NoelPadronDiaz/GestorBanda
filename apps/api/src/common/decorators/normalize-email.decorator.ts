import { Transform } from 'class-transformer';
import { normalizeEmail } from '../utils/email';

/** Recorta y pasa a minúsculas el email antes de validarlo (los espacios al pegar son habituales). */
export const NormalizeEmail = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
