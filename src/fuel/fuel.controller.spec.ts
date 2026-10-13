import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { FuelHistoryQueryDto } from './fuel-history-query.dto';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';

describe('FuelController', () => {
  it('uses the authenticated principal and never accepts a user ID in the query', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [], pagination: { limit: 25, offset: 0, hasMore: false } });
    const controller = new FuelController({ findHistoryForUser } as unknown as FuelService);
    const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['COMBUSTIBLE_REPORTAR'] } as AuthPrincipal;
    await controller.getMyHistory(principal, new FuelHistoryQueryDto());
    expect(findHistoryForUser).toHaveBeenCalledWith('55', 25, 0);
  });

  it('requires the existing fuel reporting permission', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, FuelController.prototype.getMyHistory))
      .toEqual(['COMBUSTIBLE_REPORTAR']);
  });

  it('passes only the authenticated actor and the request IP to the create operation', async () => {
    const create = vi.fn().mockResolvedValue({ id: '6' });
    const controller = new FuelController({ findHistoryForUser: vi.fn(), create } as unknown as FuelService);
    const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['COMBUSTIBLE_REPORTAR'] } as AuthPrincipal;
    const body = {
      movementId: '7', operationId: '11111111-1111-4111-8111-111111111111', kilometers: '100.0',
      deviceAt: '2026-05-01T11:00:00Z', gallons: '1.000', pricePerGallon: '2.00', totalPaid: '2.00',
    };
    await controller.create(principal, { ip: '192.0.2.20' } as never, body);
    expect(create).toHaveBeenCalledWith({ ...body, userId: '55', auditIp: '192.0.2.20' });
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, FuelController)).toEqual(['COMBUSTIBLE_REPORTAR']);
  });
});
