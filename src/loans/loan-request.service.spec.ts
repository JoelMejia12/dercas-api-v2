import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LoanRequestRepository } from './loan-request.repository';
import { LoanRequestService } from './loan-request.service';

describe('LoanRequestService lookup', () => {
  it('returns the repository request summary', async () => {
    const request = { id: '7', vehicleId: '9', status: 'SOLICITADO', requestedAt: '2025-01-01T00:00:00.000Z', destination: null, reason: null };
    const findByIdForUser = vi.fn().mockResolvedValue(request);
    const service = new LoanRequestService({ findByIdForUser } as unknown as LoanRequestRepository);
    await expect(service.findById('7', '22')).resolves.toBe(request);
  });

  it('returns the same not-found response for absent and non-owned requests', async () => {
    const findByIdForUser = vi.fn().mockResolvedValue(null);
    const service = new LoanRequestService({ findByIdForUser } as unknown as LoanRequestRepository);
    await expect(service.findById('7', '22')).rejects.toBeInstanceOf(NotFoundException);
  });
});
