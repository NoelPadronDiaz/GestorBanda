import {
  type ArgumentsHost,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../context/request-context.service';
import { AppException } from '../errors/app.exception';
import { createValidationPipe } from '../pipes/validation.pipe';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { IsEmail } from 'class-validator';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', originalUrl: '/x', ctx: { traceId: 'trace-123' } }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter(new RequestContextService()).catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('serializes AppException as { code, message, details, trace_id }', () => {
    const { status, body } = run(
      new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'dup', { a: 1 }),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      code: 'CONFLICT',
      message: 'dup',
      details: { a: 1 },
      trace_id: 'trace-123',
    });
  });

  it('maps framework HttpExceptions to stable codes', () => {
    expect(run(new NotFoundException('nope')).body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'nope',
    });
    expect(run(new UnauthorizedException()).body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('maps Prisma unique violations to 409 UNIQUE_VIOLATION', () => {
    const error = new Prisma.PrismaClientKnownRequestError('boom', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    const { status, body } = run(error);
    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'UNIQUE_VIOLATION', details: { target: ['email'] } });
  });

  it('never leaks internals of unexpected errors', () => {
    const { status, body } = run(new Error('SELECT * FROM secrets failed'));
    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
      trace_id: 'trace-123',
    });
  });

  it('exposes field-level details for validation failures', async () => {
    class Body {
      @IsEmail()
      email!: string;
    }
    const pipe = createValidationPipe();
    const error = await pipe
      .transform({ email: 'not-an-email' }, { type: 'body', metatype: Body })
      .catch((e: unknown) => e);

    const { status, body } = run(error);
    expect(status).toBe(400);
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', messages: [expect.any(String)] }],
    });
  });
});
