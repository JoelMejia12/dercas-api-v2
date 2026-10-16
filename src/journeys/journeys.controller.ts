import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';
import { JourneyIdParamDto } from './journey-id-param.dto';
import { JourneyHistoryPage, JourneysService } from './journeys.service';
import { JourneyRecord } from './journeys.repository';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { JourneyResponse } from '../openapi/domain-response.models';
import { JourneyActionDto } from './journey-action.dto';
import { JsonNullInterceptor } from '../common/http/json-null.interceptor';

@Controller('journeys')
@ApiAuthenticated('Journeys')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ASIGNADO')
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}

  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('VEHICULO_USAR_ASIGNADO', 'JORNADA_INICIAR')
  @ApiModelResponse(JourneyResponse, false, HttpStatus.CREATED)
  start(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: JourneyActionDto,
  ): Promise<JourneyRecord> {
    return this.journeys.start({ ...body, userId: principal.userId, auditIp: request.ip ?? '' });
  }

  @Patch(':id/finish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('VEHICULO_USAR_ASIGNADO', 'JORNADA_FINALIZAR')
  @ApiModelResponse(JourneyResponse)
  finish(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Param() params: JourneyIdParamDto,
    @Body() body: JourneyActionDto,
  ): Promise<JourneyRecord> {
    return this.journeys.finish({ ...body, journeyId: params.id, userId: principal.userId, auditIp: request.ip ?? '' });
  }

  @Get('me/history')
  @ApiItemsPaginationResponse(JourneyResponse)
  getMyHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: JourneyHistoryQueryDto): Promise<JourneyHistoryPage> {
    return this.journeys.findHistoryForUser(principal.userId, query);
  }

  @Get('me/current')
  @UseInterceptors(JsonNullInterceptor)
  @ApiModelResponse(JourneyResponse, true)
  getCurrent(@CurrentAuth() principal: AuthPrincipal): Promise<JourneyRecord | null> {
    return this.journeys.findCurrentForUser(principal.userId);
  }

  @Get(':id')
  @ApiModelResponse(JourneyResponse)
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: JourneyIdParamDto): Promise<JourneyRecord> {
    return this.journeys.findByIdForUser(params.id, principal.userId);
  }
}
