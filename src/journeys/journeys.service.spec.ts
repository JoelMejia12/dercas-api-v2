import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';
import { JourneysRepository } from './journeys.repository';
import { JourneysService } from './journeys.service';

describe('JourneysService', () => {
  it('returns pagination metadata for personal history', async () => {
    const findHistoryForUser = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    await expect(new JourneysService({ findHistoryForUser } as unknown as JourneysRepository)
      .findHistoryForUser('8', new JourneyHistoryQueryDto())).resolves.toMatchObject({
        items: [], pagination: { limit: 25, offset: 0, hasMore: false },
      });
  });

  it('hides missing or foreign journeys as not found', async () => {
    const findByIdForUser = vi.fn().mockResolvedValue(null);
    await expect(new JourneysService({ findByIdForUser } as unknown as JourneysRepository)
      .findByIdForUser('12', '8')).rejects.toBeInstanceOf(NotFoundException);
  });
});
