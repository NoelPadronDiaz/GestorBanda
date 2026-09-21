import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@alcaravan/shared';

/** Excepción de dominio con código estable; el filtro global la serializa a { code, message, details, trace_id }. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown = null,
  ) {
    super({ code, message, details }, status);
  }
}
