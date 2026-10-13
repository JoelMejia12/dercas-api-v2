import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('uses only the authenticated principal for personal routes', async () => {
    const service = { getMyProfile: vi.fn(), getMyAccess: vi.fn() };
    const controller = new UsersController(service as unknown as UsersService);
    const principal = { userId: '41', sessionId: '3', deviceId: '8', permissions: [] } as AuthPrincipal;
    controller.getMyProfile(principal);
    controller.getMyAccess(principal);
    expect(service.getMyProfile).toHaveBeenCalledWith('41');
    expect(service.getMyAccess).toHaveBeenCalledWith('41');
  });

  it('requires the existing user administration permission for global reads', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, UsersController.prototype.listUsers)).toEqual(['USUARIOS_ADMINISTRAR']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, UsersController.prototype.getUser)).toEqual(['USUARIOS_ADMINISTRAR']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, UsersController.prototype.getUserAccess)).toEqual(['USUARIOS_ADMINISTRAR']);
  });

  it('does not pass user supplied fields when returning administrative effective access', async () => {
    const getUserAccess = vi.fn().mockResolvedValue({ roles: [], permissions: [] });
    const controller = new UsersController({ getUserAccess } as never);
    await controller.getUserAccess({ id: '9' } as never);
    expect(getUserAccess).toHaveBeenCalledWith('9');
  });
});
