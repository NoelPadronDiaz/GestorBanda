import type { TFunction } from 'i18next';
import { ApiError } from './client';

/** Traduce por `code` estable de la API (nunca por el `message`, que va en inglés). */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    return t(`errors.${error.code}`, { defaultValue: t('errors.UNKNOWN') });
  }
  return t('errors.NETWORK');
}
