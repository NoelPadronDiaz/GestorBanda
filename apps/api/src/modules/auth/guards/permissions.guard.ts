import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@alcaravan/shared';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception';
import type { AuthenticatedUser } from '../auth.types';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/** Guard global (se ejecuta tras JwtAuthGuard). Sin @RequirePermissions basta con estar autenticado. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    const granted = new Set(user?.permissions ?? []);
    if (!required.every((permission) => granted.has(permission))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Insufficient permissions');
    }
    return true;
  }
}
