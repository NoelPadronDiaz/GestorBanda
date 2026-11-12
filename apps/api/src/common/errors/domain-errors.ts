import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

/** Atajos para los errores de negocio más repetidos (mismo formato que el resto de la API). */

export function notFound(entity: string): AppException {
  return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${entity} not found`);
}

/** Regla de negocio incumplida. `reason` es un código estable que la web traduce. */
export function conflict(reason: string, message: string, extra: object = {}): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', message, { reason, ...extra });
}

export function invalidField(field: string, message: string): AppException {
  return new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Request validation failed', [
    { field, messages: [message] },
  ]);
}
