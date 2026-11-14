import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, RefreshTokenRevokeReason } from '@prisma/client';
import { RequestContextService } from '../../common/context/request-context.service';
import { AppException } from '../../common/errors/app.exception';
import type { Env } from '../../config/env';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from './auth.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** Valor en claro: solo existe aquí y en la cookie; en BD queda únicamente su hash. */
  token: string;
  expiresAt: Date;
  userId: string;
  familyId: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export const invalidRefreshToken = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'INVALID_REFRESH_TOKEN',
    'Invalid or expired refresh token',
  );

/**
 * Access token: JWT corto y sin estado. Refresh token: opaco, de un solo uso y rotado en cada
 * refresco. Reusar un token ya rotado fuera de la ventana de gracia revoca toda la familia.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  signAccessToken(userId: string): { token: string; expiresIn: number } {
    const payload: JwtPayload = { sub: userId };
    return {
      token: this.jwt.sign(payload),
      expiresIn: this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
    };
  }

  /** Inicia una familia nueva (login). */
  issueForLogin(userId: string): Promise<IssuedRefreshToken> {
    const absoluteExpiresAt = new Date(
      Date.now() + this.config.get('REFRESH_TOKEN_ABSOLUTE_TTL_DAYS', { infer: true }) * DAY_MS,
    );
    return this.createToken(this.prisma, { userId, familyId: randomUUID(), absoluteExpiresAt });
  }

  async rotate(rawToken: string): Promise<IssuedRefreshToken> {
    const now = new Date();
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!existing || existing.revokedAt) throw invalidRefreshToken();

    if (existing.rotatedAt) {
      const graceMs = this.config.get('REFRESH_REUSE_GRACE_SECONDS', { infer: true }) * 1000;
      if (now.getTime() - existing.rotatedAt.getTime() > graceMs) {
        await this.revokeFamily(existing.familyId, 'REUSE_DETECTED');
        await this.audit.record({
          action: 'auth.refresh.reuse_detected',
          entityType: 'USER_ACCOUNT',
          entityId: existing.userId,
          actorUserId: existing.userId,
          metadata: { family_id: existing.familyId },
        });
      }
      throw invalidRefreshToken();
    }

    if (existing.expiresAt <= now) throw invalidRefreshToken();

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: now },
      });
      if (claimed.count !== 1) throw invalidRefreshToken();
      return this.createToken(tx, {
        userId: existing.userId,
        familyId: existing.familyId,
        absoluteExpiresAt: existing.absoluteExpiresAt,
      });
    });
  }

  /** Revoca la familia del token recibido (logout). Devuelve el usuario afectado o null si no existe. */
  async revokeByRawToken(
    rawToken: string,
    reason: RefreshTokenRevokeReason,
  ): Promise<string | null> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!existing) return null;
    await this.revokeFamily(existing.familyId, reason);
    return existing.userId;
  }

  /** Cierra todas las sesiones abiertas de un usuario (p. ej. al cambiar la contraseña). */
  async revokeAllForUser(userId: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeFamily(familyId: string, reason: RefreshTokenRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private async createToken(
    client: Prisma.TransactionClient | PrismaService,
    family: { userId: string; familyId: string; absoluteExpiresAt: Date },
  ): Promise<IssuedRefreshToken> {
    const ttlMs = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
    const expiresAt = new Date(Math.min(Date.now() + ttlMs, family.absoluteExpiresAt.getTime()));
    const token = generateOpaqueToken();
    const ctx = this.requestContext.get();

    await client.refreshToken.create({
      data: {
        userId: family.userId,
        familyId: family.familyId,
        tokenHash: hashToken(token),
        userAgent: ctx?.userAgent ?? null,
        ipAddress: ctx?.ipAddress ?? null,
        expiresAt,
        absoluteExpiresAt: family.absoluteExpiresAt,
      },
    });
    return { token, expiresAt, userId: family.userId, familyId: family.familyId };
  }
}
