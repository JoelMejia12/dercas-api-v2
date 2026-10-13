import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateMaintenanceOrderDto, MaintenanceOrderHistoryQueryDto } from './maintenance.dto';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceController', () => {
  it('uses the principal for personal reads and request peer for audited writes', async () => {
    const findOrdersForCurrentVehicle = vi.fn().mockResolvedValue({ items: [] });
    const createOrder = vi.fn().mockResolvedValue({ id: '71' });
    const controller = new MaintenanceController({ findOrdersForCurrentVehicle, createOrder } as unknown as MaintenanceService);
    const principal = { userId: '8', sessionId: '9', deviceId: '10', permissions: [] } as AuthPrincipal;
    await controller.getMyVehicleOrders(principal, new MaintenanceOrderHistoryQueryDto());
    await controller.createOrder(principal, { ip: '192.0.2.8' } as never, Object.assign(new CreateMaintenanceOrderDto(), { reason: 'Revisión' }));
    expect(findOrdersForCurrentVehicle).toHaveBeenCalledWith('8', expect.any(MaintenanceOrderHistoryQueryDto));
    expect(createOrder).toHaveBeenCalledWith({ userId: '8', auditIp: '192.0.2.8', reason: 'Revisión', observations: undefined });
  });

  it('requires assigned-vehicle scope for reads and the maintenance creation permission for writes', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, MaintenanceController)).toEqual(['VEHICULO_USAR_ASIGNADO']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, MaintenanceController.prototype.createOrder)).toEqual(['MANTENIMIENTO_CREAR']);
  });
});
