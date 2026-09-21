import type { ReactNode } from 'react';
import type { Permission } from '@alcaravan/shared';
import { useAuth } from './use-auth';

/** Renderiza a sus hijos solo si el usuario tiene el permiso (botones, secciones). */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : null;
}
