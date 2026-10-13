import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ActiveBlockingMaintenanceOrderError, MaintenanceRepository, NoAssignedVehicleForMaintenanceError } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceOrderHistoryQueryDto } from './maintenance.dto';

describe('MaintenanceService', () => {
  it('returns a paginated order result', async () => {
    const findOrdersForCurrentVehicle = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    await expect(new MaintenanceService({ findOrdersForCurrentVehicle } as unknown as MaintenanceRepository)
      .findOrdersForCurrentVehicle('8', new MaintenanceOrderHistoryQueryDto())).resolves.toMatchObject({
        items: [], pagination: { limit: 25, offset: 0, hasMore: false },
      });
  });

  it('maps unavailable assigned vehicle and duplicate blocking order errors', async () => {
    const createOrder = vi.fn().mockRejectedValueOnce(new NoAssignedVehicleForMaintenanceError())
      .mockRejectedValueOnce(new ActiveBlockingMaintenanceOrderError());
    const service = new MaintenanceService({ createOrder } as unknown as MaintenanceRepository);
    const input = { userId: '8', auditIp: '192.0.2.8' };
    await expect(service.createOrder(input)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createOrder(input)).rejects.toBeInstanceOf(ConflictException);
  });
});
