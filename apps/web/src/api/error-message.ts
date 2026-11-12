import type { TFunction } from 'i18next';
import { ApiError } from './client';

/**
 * Traduce por `code` estable de la API (nunca por el `message`, que va en inglés). Los conflictos
 * de negocio llevan además `details.reason` (p. ej. INVOICE_ACCOUNTED), con su propio texto.
 */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const reason = (error.details as { reason?: string } | null)?.reason;
    if (reason) {
      const translated = t(`errors.reasons.${reason}`, { defaultValue: '' });
      if (translated) return translated;
    }
    if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
      const fields = (error.details as { field: string }[])
        .map((detail) => detail.field)
        .join(', ');
      return `${t('errors.VALIDATION_ERROR')} (${fields})`;
    }
    return t(`errors.${error.code}`, { defaultValue: t('errors.UNKNOWN') });
  }
  return t('errors.NETWORK');
}
