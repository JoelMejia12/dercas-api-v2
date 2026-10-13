import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { GpsController } from './gps.controller';
import { GpsReadRepository } from './gps-read.repository';
import { GpsReadService } from './gps-read.service';

describe('GpsController', () => {
  it('applies only existing GPS permissions to broad or administrative reads', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getLatestByVehicle)).toEqual(['GPS_VER_TIEMPO_REAL']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getMySessions)).toEqual(['GPS_HISTORICO_VER']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getConfiguration)).toEqual(['GPS_ADMINISTRAR']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getArchives)).toEqual(['GPS_ARCHIVAR']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getVehiclePositionHistory)).toEqual(['GPS_HISTORICO_VER']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getManagedDevices)).toEqual(['DISPOSITIVOS_ADMINISTRAR']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, GpsController.prototype.getManagedDevice)).toEqual(['DISPOSITIVOS_ADMINISTRAR']);
  });

  it('derives own location, device, sessions and restoration scope from principal', () => {
    const methods = { findMySessions: vi.fn(), findMySession: vi.fn(), findMySessionPositions: vi.fn(), findMyRestorations: vi.fn(), findRestorationPositions: vi.fn() };
    const repository = { findMyLatest: vi.fn(), findOwnDeviceStatus: vi.fn() };
    const controller = new GpsController(methods as unknown as GpsReadService, repository as unknown as GpsReadRepository);
    const principal = { userId: '22', sessionId: '33', deviceId: '44', permissions: [] } as AuthPrincipal;
    controller.getMyLatest(principal); controller.getMyDeviceStatus(principal);
    expect(repository.findMyLatest).toHaveBeenCalledWith('22');
    expect(repository.findOwnDeviceStatus).toHaveBeenCalledWith('44');
  });

  it('routes administrative device detail through the protected diagnostic service', () => {
    const service = { findManagedDevice: vi.fn() };
    const controller = new GpsController(service as unknown as GpsReadService, {} as GpsReadRepository);
    controller.getManagedDevice({ id: '15' });
    expect(service.findManagedDevice).toHaveBeenCalledWith('15');
  });
});
