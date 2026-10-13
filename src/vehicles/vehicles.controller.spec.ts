import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { VehicleService } from './vehicle.service';
import { VehiclesController } from './vehicles.controller';

describe('VehiclesController', () => {
  it('passes only the authenticated principal’s user ID to the assigned-vehicle operation', async () => {
    const findCurrentUserVehicle = vi.fn().mockResolvedValue(null);
    const controller = new VehiclesController({ findCurrentUserVehicle } as unknown as VehicleService);
    const principal = { userId: '55', sessionId: '12', deviceId: '4', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    await expect(controller.getCurrentUserVehicle(principal)).resolves.toBeNull();
    expect(findCurrentUserVehicle).toHaveBeenCalledWith('55');
  });

  it('declares the existing assigned-vehicle permission and no implicit role bypass', () => {
    const required = Reflect.getMetadata(REQUIRED_PERMISSIONS, VehiclesController.prototype.getCurrentUserVehicle);
    expect(required).toEqual(['VEHICULO_USAR_ASIGNADO']);
  });

  it('protects new reads with existing permissions and derives personal scope from the principal', () => {
    const historyPermission = Reflect.getMetadata(REQUIRED_PERMISSIONS, VehiclesController.prototype.getMyAssignmentHistory);
    const maintenancePermission = Reflect.getMetadata(REQUIRED_PERMISSIONS, VehiclesController.prototype.getAssignedVehicleMaintenanceStatus);
    const availabilityPermission = Reflect.getMetadata(REQUIRED_PERMISSIONS, VehiclesController.prototype.getAdministrativeAvailability);
    expect(historyPermission).toEqual(['VEHICULO_USAR_ASIGNADO']);
    expect(maintenancePermission).toEqual(['VEHICULO_USAR_ASIGNADO']);
    expect(availabilityPermission).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);

    const calls = { history: vi.fn(), maintenance: vi.fn() };
    const controller = new VehiclesController({ findMyAssignmentHistory: calls.history, findAssignedVehicleMaintenanceStatus: calls.maintenance } as unknown as VehicleService);
    const principal = { userId: '700', sessionId: '1', deviceId: '2', permissions: ['VEHICULO_USAR_ASIGNADO'] } as AuthPrincipal;
    controller.getMyAssignmentHistory(principal);
    controller.getAssignedVehicleMaintenanceStatus(principal);
    expect(calls.history).toHaveBeenCalledWith('700');
    expect(calls.maintenance).toHaveBeenCalledWith('700');
  });
});
