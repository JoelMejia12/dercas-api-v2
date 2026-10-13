import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { AlertHistoryQueryDto, AlertIdParamDto } from './alerts.dto';
import { AlertsService } from './alerts.service';

@Controller('alerts/me')
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}
  @Get() findMine(@CurrentAuth() principal: AuthPrincipal, @Query() query: AlertHistoryQueryDto) {
    return this.alerts.findForUser(principal.userId, principal.permissions.includes('VEHICULO_USAR_ASIGNADO'), query);
  }
  @Get(':id') findMineById(@CurrentAuth() principal: AuthPrincipal, @Param() params: AlertIdParamDto) {
    return this.alerts.findByIdForUser(params.id, principal.userId, principal.permissions.includes('VEHICULO_USAR_ASIGNADO'));
  }
}
