import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';
import { JourneyIdParamDto } from './journey-id-param.dto';
import { JourneyHistoryPage, JourneysService } from './journeys.service';
import { JourneyRecord } from './journeys.repository';

@Controller('journeys')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ASIGNADO')
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}

  @Get('me/history')
  getMyHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: JourneyHistoryQueryDto): Promise<JourneyHistoryPage> {
    return this.journeys.findHistoryForUser(principal.userId, query);
  }

  @Get('me/current')
  getCurrent(@CurrentAuth() principal: AuthPrincipal): Promise<JourneyRecord | null> {
    return this.journeys.findCurrentForUser(principal.userId);
  }

  @Get(':id')
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: JourneyIdParamDto): Promise<JourneyRecord> {
    return this.journeys.findByIdForUser(params.id, principal.userId);
  }
}
