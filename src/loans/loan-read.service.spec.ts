import { describe, expect, it, vi } from 'vitest';
import { LoanReadItem, LoanReadRepository } from './loan-read.repository';
import { LoanReadService } from './loan-read.service';

const loan = (id: string): LoanReadItem => ({
  id, status: 'ACTIVO', requestedAt: '2025-01-01T00:00:00.000Z', keyWithdrawnAt: null,
  useStartedAt: null, useEndedAt: null, keyReturnedAt: null, destination: null, reason: null,
  returnObservations: null,
  vehicle: { id: '9', plate: 'P-9', make: 'Marca', model: null, kind: 'ADMINISTRATIVO', operationalState: 'DISPONIBLE' },
  movement: null,
});

describe('LoanReadService', () => {
  it('returns an empty personal history with stable pagination metadata', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue([]);
    const service = new LoanReadService({ findHistoryForUser } as unknown as LoanReadRepository);
    await expect(service.findHistoryForUser('8', 25, 0)).resolves.toEqual({
      items: [], pagination: { limit: 25, offset: 0, hasMore: false },
    });
    expect(findHistoryForUser).toHaveBeenCalledWith('8', { limit: 25, offset: 0 });
  });

  it('trims the lookahead row and sets hasMore', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue([loan('3'), loan('2'), loan('1')]);
    const service = new LoanReadService({ findHistoryForUser } as unknown as LoanReadRepository);
    await expect(service.findHistoryForUser('8', 2, 0)).resolves.toEqual({
      items: [loan('3'), loan('2')], pagination: { limit: 2, offset: 0, hasMore: true },
    });
  });

  it('returns requestable vehicle availability with pagination metadata', async () => {
    const items = [{ vehicle: { id: '22', plate: 'ABC', make: 'Marca', model: null }, latestKilometers: '12.0' }];
    const findAvailableAdministrativeVehicles = vi.fn().mockResolvedValue({ items, hasMore: true });
    const service = new LoanReadService({ findAvailableAdministrativeVehicles } as unknown as LoanReadRepository);
    await expect(service.findAvailableAdministrativeVehicles(1, 5)).resolves.toEqual({
      items, pagination: { limit: 1, offset: 5, hasMore: true },
    });
  });
});
