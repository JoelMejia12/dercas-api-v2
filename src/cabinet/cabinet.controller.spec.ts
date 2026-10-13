import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../auth/auth.decorators';
import { CabinetController } from './cabinet.controller';
import { CabinetService } from './cabinet.service';

describe('CabinetController', () => {
  it('requires the existing cabinet view permission for every read route', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, CabinetController)).toEqual(['GABINETE_VER']);
  });

  it('delegates cabinet, keyring, event, and position reads', async () => {
    const methods = { findCabinets: vi.fn(), findKeyrings: vi.fn(), findEvents: vi.fn(), findPositions: vi.fn() };
    const controller = new CabinetController(methods as unknown as CabinetService);
    const query = {} as never;
    controller.findCabinets(query); controller.findKeyrings(query); controller.findEvents(query);
    controller.findPositions({ id: '7' } as never);
    expect(methods.findCabinets).toHaveBeenCalledWith(query);
    expect(methods.findKeyrings).toHaveBeenCalledWith(query);
    expect(methods.findEvents).toHaveBeenCalledWith(query);
    expect(methods.findPositions).toHaveBeenCalledWith('7');
  });
});
