import type { Permission } from '@alcaravan/shared';

/** Identidad resuelta en cada petición a partir del JWT; los permisos se leen de BD, no del token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  memberId: string | null;
  lastLoginAt: Date | null;
  roles: string[];
  permissions: Permission[];
}

export interface JwtPayload {
  sub: string;
}
