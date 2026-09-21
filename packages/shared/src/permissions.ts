/**
 * Catálogo de permisos. Formato: `<recurso>.<acción>`.
 * Cada módulo nuevo añade aquí sus permisos; el seed de la API los sincroniza con la BD.
 */
export const PERMISSIONS = [
  'users.read',
  'users.invite',
  'roles.read',
  'band_profile.read',
  'band_profile.update',
  'members.read',
  'members.create',
  'members.update',
  'members.delete',
  'documents.read',
  'documents.upload',
  'documents.delete',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_CODES = [
  'ADMIN',
  'PRESIDENT',
  'TREASURER',
  'SECRETARY',
  'DIRECTOR',
  'SCHOOL_ADMIN',
  'TEACHER',
  'MUSICIAN',
  'READ_ONLY',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/**
 * Matriz por defecto de los roles de sistema. El seed deja los roles `is_system`
 * exactamente con estos permisos. Los permisos de módulos futuros se añaden aquí.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  ADMIN: ALL,
  PRESIDENT: [
    'users.read',
    'users.invite',
    'roles.read',
    'band_profile.read',
    'band_profile.update',
    'members.read',
    'members.create',
    'members.update',
    'members.delete',
    'documents.read',
    'documents.upload',
    'audit.read',
  ],
  TREASURER: ['band_profile.read', 'members.read', 'documents.read', 'documents.upload'],
  SECRETARY: [
    'users.read',
    'users.invite',
    'band_profile.read',
    'band_profile.update',
    'members.read',
    'members.create',
    'members.update',
    'documents.read',
    'documents.upload',
  ],
  DIRECTOR: ['band_profile.read', 'members.read'],
  SCHOOL_ADMIN: ['band_profile.read', 'members.read', 'members.create', 'members.update'],
  TEACHER: ['band_profile.read', 'members.read'],
  MUSICIAN: ['band_profile.read'],
  READ_ONLY: ['band_profile.read', 'members.read'],
};

export const ROLE_NAMES: Record<RoleCode, string> = {
  ADMIN: 'Administrador',
  PRESIDENT: 'Presidencia',
  TREASURER: 'Tesorería',
  SECRETARY: 'Secretaría',
  DIRECTOR: 'Dirección musical',
  SCHOOL_ADMIN: 'Administración de la escuela',
  TEACHER: 'Profesorado',
  MUSICIAN: 'Músico',
  READ_ONLY: 'Solo lectura',
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
