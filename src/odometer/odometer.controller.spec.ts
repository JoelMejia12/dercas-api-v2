import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';
import { OdometerController } from './odometer.controller';
import { OdometerService } from './odometer.service';

describe('OdometerController', () => {
  it('uses only the authenticated principal for personal readings', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [], pagination: { limit: 25, offset: 0, hasMore: false } });
    const controller = new OdometerController({ findHistoryForUser } as unknown as OdometerService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    await controller.getMyHistory(principal, new OdometerHistoryQueryDto());
    expect(findHistoryForUser).toHaveBeenCalledWith('8', expect.any(OdometerHistoryQueryDto));
  });

  it('requires the existing assigned-vehicle permission', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, OdometerController)).toEqual(['VEHICULO_USAR_ASIGNADO']);
  });
});
