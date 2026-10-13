import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { LoanHistoryQueryDto } from './loan-history-query.dto';
import { LoanReadService } from './loan-read.service';
import { LoansController } from './loans.controller';

describe('LoansController', () => {
  const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['VEHICULO_USAR_ADMINISTRATIVO'] } as AuthPrincipal;

  it('scopes active loans to the authenticated principal', async () => {
    const findActiveForUser = vi.fn().mockResolvedValue([]);
    const controller = new LoansController({ findActiveForUser } as unknown as LoanReadService);
    await expect(controller.getActive(principal)).resolves.toEqual([]);
    expect(findActiveForUser).toHaveBeenCalledTimes(1);
    expect(findActiveForUser).toHaveBeenCalledWith('55');
  });

  it('scopes history to the authenticated principal and forwards validated pagination', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [], pagination: { limit: 10, offset: 20, hasMore: false } });
    const controller = new LoansController({ findHistoryForUser } as unknown as LoanReadService);
    const query = Object.assign(new LoanHistoryQueryDto(), { limit: 10, offset: 20 });
    await controller.getHistory(principal, query);
    expect(findHistoryForUser).toHaveBeenCalledTimes(1);
    expect(findHistoryForUser).toHaveBeenCalledWith('55', 10, 20);
  });

  it('queries official administrative availability with validated pagination', async () => {
    const findAvailableAdministrativeVehicles = vi.fn().mockResolvedValue({ items: [], pagination: { limit: 3, offset: 6, hasMore: false } });
    const controller = new LoansController({ findAvailableAdministrativeVehicles } as unknown as LoanReadService);
    await controller.getAvailableVehicles(Object.assign(new LoanHistoryQueryDto(), { limit: 3, offset: 6 }));
    expect(findAvailableAdministrativeVehicles).toHaveBeenCalledWith(3, 6);
  });

  it('requires the existing candidate permission and has no role bypass', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, LoansController)).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);
  });

  it('denies this read when the authenticated principal lacks the candidate permission', () => {
    const guard = new PermissionsGuard({
      getAllAndOverride: () => Reflect.getMetadata(REQUIRED_PERMISSIONS, LoansController),
    } as never);
    const context = {
      getHandler: () => LoansController.prototype.getActive,
      getClass: () => LoansController,
      switchToHttp: () => ({ getRequest: () => ({ authPrincipal: { ...principal, permissions: [] } }) }),
    };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
    const permittedContext = {
      ...context,
      switchToHttp: () => ({ getRequest: () => ({ authPrincipal: principal }) }),
    };
    expect(guard.canActivate(permittedContext as never)).toBe(true);
  });
});
