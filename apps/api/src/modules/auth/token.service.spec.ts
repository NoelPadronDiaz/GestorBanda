import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { RequestContextService } from '../../common/context/request-context.service';
import { AppException } from '../../common/errors/app.exception';
import type { Env } from '../../config/env';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { TokenService, hashToken } from './token.service';

interface Row {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

/** Fake en memoria de la parte de Prisma que usa TokenService. */
function createFakePrisma() {
  const rows: Row[] = [];
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) =>
      value === null ? row[key as keyof Row] == null : row[key as keyof Row] === value,
    );

  const refreshToken = {
    create: jest.fn(
      async ({ data }: { data: Omit<Row, 'id' | 'rotatedAt' | 'revokedAt' | 'revokedReason'> }) => {
        const row: Row = {
          id: `row-${rows.length + 1}`,
          rotatedAt: null,
          revokedAt: null,
          revokedReason: null,
          ...data,
        };
        rows.push(row);
        return row;
      },
    ),
    findUnique: jest.fn(
      async ({ where }: { where: { tokenHash: string } }) =>
        rows.find((row) => row.tokenHash === where.tokenHash) ?? null,
    ),
    updateMany: jest.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const targets = rows.filter((row) => matches(row, where));
        targets.forEach((row) => Object.assign(row, data));
        return { count: targets.length };
      },
    ),
  };
  const prisma = {
    refreshToken,
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback({ refreshToken }),
  };
  return { prisma: prisma as unknown as PrismaService, rows };
}

function createService() {
  const { prisma, rows } = createFakePrisma();
  const values: Partial<Env> = {
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 14,
    REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 90,
    REFRESH_REUSE_GRACE_SECONDS: 10,
  };
  const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
  const jwt = { sign: jest.fn(() => 'signed.jwt') } as unknown as JwtService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new TokenService(
    prisma,
    jwt,
    config,
    new RequestContextService(),
    audit as unknown as AuditService,
  );
  return { service, rows, audit };
}

async function expectInvalidRefresh(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
}

describe('TokenService', () => {
  it('stores only the hash of the refresh token', async () => {
    const { service, rows } = createService();
    const issued = await service.issueForLogin('user-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(issued.token));
    expect(JSON.stringify(rows[0])).not.toContain(issued.token);
  });

  it('rotates: marks the old token as rotated and issues a new one in the same family', async () => {
    const { service, rows } = createService();
    const first = await service.issueForLogin('user-1');

    const second = await service.rotate(first.token);

    expect(second.token).not.toBe(first.token);
    expect(second.familyId).toBe(first.familyId);
    expect(rows[0].rotatedAt).toBeInstanceOf(Date);
    expect(rows[1].rotatedAt).toBeNull();
  });

  it('never extends a family beyond its absolute expiry', async () => {
    const { service, rows } = createService();
    const first = await service.issueForLogin('user-1');
    rows[0].absoluteExpiresAt = new Date(Date.now() + 60_000);

    const second = await service.rotate(first.token);

    expect(second.expiresAt.getTime()).toBeLessThanOrEqual(rows[0].absoluteExpiresAt.getTime());
  });

  it('rejects an unknown token', async () => {
    const { service } = createService();
    await expectInvalidRefresh(service.rotate('does-not-exist'));
  });

  it('rejects an expired token', async () => {
    const { service, rows } = createService();
    const issued = await service.issueForLogin('user-1');
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expectInvalidRefresh(service.rotate(issued.token));
  });

  it('rejects a revoked token', async () => {
    const { service } = createService();
    const issued = await service.issueForLogin('user-1');
    await service.revokeByRawToken(issued.token, 'LOGOUT');

    await expectInvalidRefresh(service.rotate(issued.token));
  });

  it('does not revoke the family when a just-rotated token is reused within the grace window', async () => {
    const { service, rows, audit } = createService();
    const first = await service.issueForLogin('user-1');
    await service.rotate(first.token);

    await expectInvalidRefresh(service.rotate(first.token));

    expect(rows[1].revokedAt).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('revokes the whole family and audits when a rotated token is reused after the grace window', async () => {
    const { service, rows, audit } = createService();
    const first = await service.issueForLogin('user-1');
    const second = await service.rotate(first.token);
    rows[0].rotatedAt = new Date(Date.now() - 60_000);

    await expectInvalidRefresh(service.rotate(first.token));

    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    expect(rows[1].revokedReason).toBe('REUSE_DETECTED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh.reuse_detected', actorUserId: 'user-1' }),
    );
    await expectInvalidRefresh(service.rotate(second.token));
  });
});
