import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports process liveness without checking PostgreSQL', () => {
    const database = { checkAvailability: vi.fn(), isConfigured: false };
    expect(new HealthService(database as unknown as DatabaseService).live()).toEqual({ status: 'alive' });
    expect(database.checkAvailability).not.toHaveBeenCalled();
  });

  it('reports the database as not configured without revealing connection details', async () => {
    const health = new HealthService({ isConfigured: false } as DatabaseService);
    await expect(health.readiness()).resolves.toEqual({
      status: 'not_ready',
      checks: { process: 'up', database: 'not_configured' },
    });
  });

  it('reflects database availability for readiness', async () => {
    const database = { isConfigured: true, checkAvailability: vi.fn().mockResolvedValue(true) };
    await expect(new HealthService(database as unknown as DatabaseService).readiness()).resolves.toEqual({
      status: 'ready',
      checks: { process: 'up', database: 'up' },
    });
  });
});
