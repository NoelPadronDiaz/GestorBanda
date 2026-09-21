/** Códigos de error estables. El frontend traduce por `code`, nunca por `message`. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'INVALID_INVITATION',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNIQUE_VIOLATION',
  'FOREIGN_KEY_VIOLATION',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Formato de error único de toda la API. */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details: unknown;
  trace_id: string;
}
