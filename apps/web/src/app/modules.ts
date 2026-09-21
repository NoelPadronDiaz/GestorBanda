import type { LucideIcon } from 'lucide-react';
import { Building2, LayoutDashboard, Users } from 'lucide-react';
import type { Permission } from '@alcaravan/shared';

export interface AppModule {
  id: string;
  path: string;
  /** Clave i18n de la etiqueta. */
  labelKey: string;
  icon: LucideIcon;
  /** Sin permiso = visible para cualquier usuario autenticado. */
  permission?: Permission;
}

/**
 * Navegación por módulos. Cada módulo de negocio nuevo (accounting, billing, events...) añade
 * aquí su entrada y su ruta en router.tsx con el mismo permiso.
 */
export const APP_MODULES: readonly AppModule[] = [
  { id: 'dashboard', path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  {
    id: 'members',
    path: '/members',
    labelKey: 'nav.members',
    icon: Users,
    permission: 'members.read',
  },
  {
    id: 'band-profile',
    path: '/band-profile',
    labelKey: 'nav.bandProfile',
    icon: Building2,
    permission: 'band_profile.read',
  },
];
