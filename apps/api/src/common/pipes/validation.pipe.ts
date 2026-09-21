import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppException } from '../errors/app.exception';

export interface FieldError {
  field: string;
  messages: string[];
}

export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** ValidationPipe estricto: descarta y rechaza propiedades desconocidas, y devuelve el formato de error estable. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed',
        flattenValidationErrors(errors),
      ),
  });
}
