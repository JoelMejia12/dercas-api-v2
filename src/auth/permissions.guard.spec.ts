import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  it('denies when permissions are unassigned or metadata is absent', () => {
    const reflector = { getAllAndOverride: () => ['vehicle.read'] };
    const guard = new PermissionsGuard(reflector as never);
    const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ authPrincipal: { permissions: [] } }) }) };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
    const noMeta = new PermissionsGuard({ getAllAndOverride: () => undefined } as never);
    expect(() => noMeta.canActivate(context as never)).toThrow(ForbiddenException);
  });
});
