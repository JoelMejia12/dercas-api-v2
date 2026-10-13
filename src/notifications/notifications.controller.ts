import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { NotificationIdParamDto, NotificationListQueryDto } from './notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications/me')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() findMine(@CurrentAuth() principal: AuthPrincipal, @Query() query: NotificationListQueryDto) {
    return this.notifications.findForRecipient(principal.userId, query);
  }
  @Get(':id') findMineById(@CurrentAuth() principal: AuthPrincipal, @Param() params: NotificationIdParamDto) {
    return this.notifications.findByIdForRecipient(params.id, principal.userId);
  }
}
