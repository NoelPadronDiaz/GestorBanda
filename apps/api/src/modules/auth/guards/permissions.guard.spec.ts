import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../common/errors/app.exception';
import type { AuthenticatedUser } from '../auth.types';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

class Sample {
  @RequirePermissions('members.read', 'members.update')
  restricted(): void {}

  open(): void {}
}

function contextFor(handler: () => void, user?: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const sample = new Sample();

  it('allows any authenticated user when no permission is declared', () => {
    expect(guard.canActivate(contextFor(sample.open, { permissions: [] }))).toBe(true);
  });

  it('allows the user when they hold every required permission', () => {
    const user = { permissions: ['members.read', 'members.update', 'audit.read'] as const };
    expect(
      guard.canActivate(contextFor(sample.restricted, { permissions: [...user.permissions] })),
    ).toBe(true);
  });

  it('rejects with 403 FORBIDDEN when a required permission is missing', () => {
    const context = contextFor(sample.restricted, { permissions: ['members.read'] });
    expect(() => guard.canActivate(context)).toThrow(AppException);
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('rejects when there is no user on the request', () => {
    expect(() => guard.canActivate(contextFor(sample.restricted))).toThrow(AppException);
  });
});
