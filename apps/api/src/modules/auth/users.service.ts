import { Injectable } from '@nestjs/common';
import { isPermission } from '@alcaravan/shared';
import { Prisma } from '@prisma/client';
import { normalizeEmail } from '../../common/utils/email';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from './auth.types';

const userAccessArgs = {
  include: {
    roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  },
} satisfies Prisma.UserAccountDefaultArgs;

type UserWithAccess = Prisma.UserAccountGetPayload<typeof userAccessArgs>;

export function toAuthenticatedUser(user: UserWithAccess): AuthenticatedUser {
  const permissions = new Set<string>();
  for (const { role } of user.roles) {
    for (const { permission } of role.permissions) permissions.add(permission.code);
  }
  return {
    id: user.id,
    email: user.email,
    memberId: user.memberId,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles.map(({ role }) => role.code).sort(),
    permissions: [...permissions].filter(isPermission).sort(),
  };
}

/** Propietario de user_account, role, permission y user_role. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.userAccount.findUnique({ where: { email: normalizeEmail(email) } });
  }

  async emailInUse(email: string): Promise<boolean> {
    const count = await this.prisma.userAccount.count({ where: { email: normalizeEmail(email) } });
    return count > 0;
  }

  /** Devuelve null si la cuenta no existe o no está ACTIVE. Los permisos siempre se leen de BD. */
  async loadAuthenticatedUser(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.userAccount.findUnique({ where: { id }, ...userAccessArgs });
    return user && user.status === 'ACTIVE' ? toAuthenticatedUser(user) : null;
  }

  findRoleByCode(code: string) {
    return this.prisma.role.findUnique({ where: { code } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.userAccount.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}
