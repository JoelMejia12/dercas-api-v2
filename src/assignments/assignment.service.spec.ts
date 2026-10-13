import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AssignmentRepository } from './assignment.repository';
import { AssignmentService } from './assignment.service';

describe('AssignmentService', () => {
  it('hides missing and foreign assignment details as not found', async () => {
    const findByIdForPilot = vi.fn().mockResolvedValue(null);
    await expect(new AssignmentService({ findByIdForPilot } as unknown as AssignmentRepository)
      .findByIdForAuthenticatedPilot('4', '8')).rejects.toBeInstanceOf(NotFoundException);
    expect(findByIdForPilot).toHaveBeenCalledWith('4', '8');
  });

  it('returns stable pagination metadata for personal assignment history', async () => {
    const items = [{ id: '9' }] as never[];
    const findHistoryForPilot = vi.fn().mockResolvedValue({ items, hasMore: true });
    await expect(new AssignmentService({ findHistoryForPilot } as unknown as AssignmentRepository)
      .findHistoryForAuthenticatedPilot('8', 1, 2)).resolves.toEqual({
        items, pagination: { limit: 1, offset: 2, hasMore: true },
      });
  });
});
