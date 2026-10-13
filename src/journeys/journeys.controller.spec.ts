import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';
import { JourneyIdParamDto } from './journey-id-param.dto';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';

describe('JourneysController', () => {
  it('uses the authenticated principal for history and detail', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [] });
    const findByIdForUser = vi.fn().mockResolvedValue({ id: '12' });
    const findCurrentForUser = vi.fn().mockResolvedValue(null);
    const controller = new JourneysController({ findHistoryForUser, findByIdForUser, findCurrentForUser } as unknown as JourneysService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    await controller.getMyHistory(principal, new JourneyHistoryQueryDto());
    await controller.getById(principal, { id: '12' } as JourneyIdParamDto);
    await controller.getCurrent(principal);
    expect(findHistoryForUser).toHaveBeenCalledWith('8', expect.any(JourneyHistoryQueryDto));
    expect(findByIdForUser).toHaveBeenCalledWith('12', '8');
    expect(findCurrentForUser).toHaveBeenCalledWith('8');
  });

  it('requires the assigned-vehicle permission for the personal scope', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, JourneysController)).toEqual(['VEHICULO_USAR_ASIGNADO']);
  });
});
