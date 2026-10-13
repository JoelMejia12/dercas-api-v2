import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationListQueryDto } from './notification.dto';
import { NotificationItem, NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notifications: NotificationsRepository) {}

  async findForRecipient(userId: string, query: NotificationListQueryDto) {
    const page = await this.notifications.findForRecipient(userId, query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  async findByIdForRecipient(id: string, userId: string): Promise<NotificationItem> {
    const notification = await this.notifications.findByIdForRecipient(id, userId);
    if (!notification) throw new NotFoundException();
    return notification;
  }
}
