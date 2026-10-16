import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { NotificationIdParamDto, NotificationListQueryDto } from './notification.dto';
import { NotificationsService } from './notifications.service';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { NotificationResponse } from '../openapi/domain-response.models';

@Controller('notifications/me')
@ApiAuthenticated('Notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() @ApiItemsPaginationResponse(NotificationResponse) findMine(@CurrentAuth() principal: AuthPrincipal, @Query() query: NotificationListQueryDto) {
    return this.notifications.findForRecipient(principal.userId, query);
  }
  @Get(':id') @ApiModelResponse(NotificationResponse) findMineById(@CurrentAuth() principal: AuthPrincipal, @Param() params: NotificationIdParamDto) {
    return this.notifications.findByIdForRecipient(params.id, principal.userId);
  }
}
