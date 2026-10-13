import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FuelIdempotencyConflictError, FuelMovementNotFoundError, FuelRepository } from './fuel.repository';
import { FuelService } from './fuel.service';

describe('FuelService', () => {
  it('applies limit-plus-one pagination and reports whether another page exists', async () => {
    const items = Array.from({ length: 3 }, (_, index) => ({ id: String(index + 1) })) as never[];
    const findHistoryForUser = vi.fn().mockResolvedValue(items);
    const service = new FuelService({ findHistoryForUser } as unknown as FuelRepository);
    await expect(service.findHistoryForUser('8', 2, 4)).resolves.toEqual({
      items: items.slice(0, 2), pagination: { limit: 2, offset: 4, hasMore: true },
    });
    expect(findHistoryForUser).toHaveBeenCalledWith('8', { limit: 2, offset: 4 });
  });

  it('reports an empty final page without fabricating records', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue([]);
    await expect(new FuelService({ findHistoryForUser } as unknown as FuelRepository)
      .findHistoryForUser('8', 25, 0)).resolves.toEqual({
        items: [], pagination: { limit: 25, offset: 0, hasMore: false },
      });
  });

  it('maps missing movement ownership and idempotency conflicts to safe HTTP errors', async () => {
    const create = vi.fn().mockRejectedValueOnce(new FuelMovementNotFoundError()).mockRejectedValueOnce(new FuelIdempotencyConflictError());
    const service = new FuelService({ create } as unknown as FuelRepository);
    await expect(service.create({} as never)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create({} as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for records outside the caller scope', async () => {
    const service = new FuelService({ findByIdForUser: vi.fn().mockResolvedValue(null) } as unknown as FuelRepository);
    await expect(service.findByIdForUser('3', '8')).rejects.toBeInstanceOf(NotFoundException);
  });
});
