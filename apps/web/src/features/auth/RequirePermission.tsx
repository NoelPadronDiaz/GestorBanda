import { Outlet } from 'react-router';
import type { Permission } from '@alcaravan/shared';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { useAuth } from './use-auth';

/** Ruta protegida por permiso. Es solo UX: la API vuelve a comprobar el permiso en cada petición. */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <ForbiddenPage />;
}
