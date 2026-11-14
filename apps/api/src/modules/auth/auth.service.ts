import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { normalizeEmail } from '../../common/utils/email';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from './auth.types';
import { PasswordService } from './password.service';
import { invalidRefreshToken, TokenService } from './token.service';
import { UsersService } from './users.service';

export interface SessionResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthenticatedUser;
}

const invalidCredentials = () =>
  new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid email or password');

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<SessionResult> {
    const account = await this.users.findByEmail(normalizeEmail(email));
    const passwordOk = await this.passwords.verify(account?.passwordHash ?? null, password);

    if (!account || !passwordOk || account.status !== 'ACTIVE') {
      await this.audit.record({
        action: 'auth.login.failed',
        entityType: 'USER_ACCOUNT',
        entityId: account?.id ?? null,
        actorUserId: account?.id ?? null,
        metadata: {
          email: normalizeEmail(email),
          reason: !account
            ? 'unknown_user'
            : account.status !== 'ACTIVE'
              ? 'suspended'
              : 'bad_password',
        },
      });
      throw invalidCredentials();
    }

    const user = await this.users.loadAuthenticatedUser(account.id);
    if (!user) throw invalidCredentials();

    const refresh = await this.tokens.issueForLogin(user.id);
    await this.users.touchLastLogin(user.id);
    await this.audit.record({
      action: 'auth.login.succeeded',
      entityType: 'USER_ACCOUNT',
      entityId: user.id,
      actorUserId: user.id,
    });
    return this.buildSession(user, refresh.token, refresh.expiresAt);
  }

  async refresh(rawToken: string | undefined): Promise<SessionResult> {
    if (!rawToken) throw invalidRefreshToken();
    const issued = await this.tokens.rotate(rawToken);
    const user = await this.users.loadAuthenticatedUser(issued.userId);
    if (!user) {
      await this.tokens.revokeFamily(issued.familyId, 'ADMIN');
      throw invalidRefreshToken();
    }
    return this.buildSession(user, issued.token, issued.expiresAt);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const userId = await this.tokens.revokeByRawToken(rawToken, 'LOGOUT');
    if (userId) {
      await this.audit.record({
        action: 'auth.logout',
        entityType: 'USER_ACCOUNT',
        entityId: userId,
        actorUserId: userId,
      });
    }
  }

  /**
   * Cambia la contraseña del usuario autenticado. Cierra todas sus sesiones (otros dispositivos
   * incluidos) y devuelve una nueva para que este navegador siga dentro.
   * La contraseña actual incorrecta es un 400 con `reason`, no un 401: la web no debe
   * interpretarlo como sesión caducada.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionResult> {
    const account = await this.users.findPasswordHash(userId);
    const user = await this.users.loadAuthenticatedUser(userId);
    if (!account || !user) throw invalidRefreshToken();

    if (!(await this.passwords.verify(account.passwordHash, currentPassword))) {
      await this.audit.record({
        action: 'auth.password.change_failed',
        entityType: 'USER_ACCOUNT',
        entityId: userId,
        actorUserId: userId,
      });
      throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'Current password is wrong', {
        reason: 'WRONG_CURRENT_PASSWORD',
      });
    }
    if (currentPassword === newPassword) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'New password must differ', {
        reason: 'SAME_PASSWORD',
      });
    }

    await this.users.updatePassword(userId, await this.passwords.hash(newPassword));
    await this.tokens.revokeAllForUser(userId, 'LOGOUT');
    const refresh = await this.tokens.issueForLogin(userId);
    await this.audit.record({
      action: 'auth.password.changed',
      entityType: 'USER_ACCOUNT',
      entityId: userId,
      actorUserId: userId,
    });
    return this.buildSession(user, refresh.token, refresh.expiresAt);
  }

  private buildSession(
    user: AuthenticatedUser,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): SessionResult {
    const access = this.tokens.signAccessToken(user.id);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      refreshExpiresAt,
      user,
    };
  }
}
