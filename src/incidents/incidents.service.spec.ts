import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentIdempotencyConflictError, IncidentsRepository, NoActiveAssignedVehicleError } from './incidents.repository';
import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  it('maps missing assignment and idempotency conflicts to safe HTTP errors', async () => {
    const create = vi.fn().mockRejectedValueOnce(new NoActiveAssignedVehicleError()).mockRejectedValueOnce(new IncidentIdempotencyConflictError());
    const service = new IncidentsService({ create } as unknown as IncidentsRepository);
    const input = { userId: '8', type: 'OTRO' as const, description: 'Prueba', operationId: 'uuid', auditIp: '192.0.2.8' };
    await expect(service.create(input)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for missing and foreign incidents', async () => {
    const findByIdForUser = vi.fn().mockResolvedValue(null);
    await expect(new IncidentsService({ findByIdForUser } as unknown as IncidentsRepository).findByIdForUser('4', '8'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(findByIdForUser).toHaveBeenCalledWith('4', '8');
  });
});
