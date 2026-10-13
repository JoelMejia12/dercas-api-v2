import { describe, expect, it, vi } from 'vitest';
import { AuthPrincipal } from '../auth/auth.types';
import { NotificationListQueryDto } from './notification.dto';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  it('always scopes inbox and detail calls to the authenticated recipient', async () => {
    const findForRecipient = vi.fn();
    const findByIdForRecipient = vi.fn();
    const controller = new NotificationsController({ findForRecipient, findByIdForRecipient } as unknown as NotificationsService);
    const principal = { userId: '8', sessionId: '4', deviceId: '3', permissions: [] } as AuthPrincipal;
    const query = new NotificationListQueryDto();
    await controller.findMine(principal, query);
    await controller.findMineById(principal, { id: '22' });
    expect(findForRecipient).toHaveBeenCalledWith('8', query);
    expect(findByIdForRecipient).toHaveBeenCalledWith('22', '8');
  });
});
