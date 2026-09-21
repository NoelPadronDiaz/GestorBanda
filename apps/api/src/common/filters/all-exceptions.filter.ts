import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody, ErrorCode } from '@alcaravan/shared';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppException } from '../errors/app.exception';
import { RequestContextService, type RequestWithContext } from '../context/request-context.service';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

interface MappedError {
  status: number;
  code: ErrorCode;
  message: string;
  details: unknown;
}

/** Único punto que decide qué ve el cliente cuando algo falla. Nunca filtra stack traces ni SQL. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithContext>();
    const traceId = this.requestContext.traceId ?? request.ctx?.traceId ?? randomUUID();

    const mapped = this.map(exception);

    if (mapped.status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${traceId}] ${request.method} ${request.originalUrl} -> ${mapped.status} ${error.message}`,
        error.stack,
      );
    }

    const body: ApiErrorBody = {
      code: mapped.code,
      message: mapped.message,
      details: mapped.details,
      trace_id: traceId,
    };
    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        code: STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message: Array.isArray(message) ? message.join('; ') : message,
        details: null,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            code: 'UNIQUE_VIOLATION',
            message: 'A record with the same unique value already exists',
            details: { target: exception.meta?.target ?? null },
          };
        case 'P2003':
          return {
            status: HttpStatus.CONFLICT,
            code: 'FOREIGN_KEY_VIOLATION',
            message: 'The operation violates a relationship with another record',
            details: null,
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            code: 'NOT_FOUND',
            message: 'Record not found',
            details: null,
          };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
    };
  }
}
