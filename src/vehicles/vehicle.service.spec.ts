import { describe, expect, it, vi } from 'vitest';
import { VehicleRepository } from './vehicle.repository';
import { VehicleService } from './vehicle.service';

describe('VehicleService', () => {
  it('delegates the authenticated user’s assigned-vehicle lookup', async () => {
    const findActiveAssignedToUser = vi.fn().mockResolvedValue(null);
    const service = new VehicleService({ findActiveAssignedToUser } as unknown as VehicleRepository);
    await expect(service.findCurrentUserVehicle('55')).resolves.toBeNull();
    expect(findActiveAssignedToUser).toHaveBeenCalledWith('55');
  });
});
