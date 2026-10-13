import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('returns pagination metadata for the inbox', async () => {
    const findForRecipient = vi.fn().mockResolvedValue({ items: [], hasMore: false });
    const result = await new NotificationsService({ findForRecipient } as unknown as NotificationsRepository)
      .findForRecipient('8', { limit: 25, offset: 0 } as never);
    expect(result).toEqual({ items: [], pagination: { limit: 25, offset: 0, hasMore: false } });
  });
  it('returns not found for missing or foreign notification details', async () => {
    const repository = { findByIdForRecipient: vi.fn().mockResolvedValue(null) } as unknown as NotificationsRepository;
    await expect(new NotificationsService(repository).findByIdForRecipient('5', '8')).rejects.toBeInstanceOf(NotFoundException);
  });
});
