import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@alcaravan/shared';

export const PERMISSIONS_KEY = 'auth:permissions';

/** El usuario debe tener TODOS los permisos indicados. Se valida siempre en el backend. */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
