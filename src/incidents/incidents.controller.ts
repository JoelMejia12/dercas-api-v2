import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateEmergencyDto, CreateIncidentDto, IncidentIdParamDto } from './incident.dto';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';
import { IncidentHistoryPage, IncidentsService } from './incidents.service';
import { IncidentRecord } from './incidents.repository';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { IncidentResponse } from '../openapi/domain-response.models';

@Controller('incidents')
@ApiAuthenticated('Incidents')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('INCIDENCIA_REPORTAR')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiModelResponse(IncidentResponse, false, HttpStatus.CREATED)
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: CreateIncidentDto,
  ): Promise<IncidentRecord> {
    return this.incidents.create({
      userId: principal.userId,
      // trust proxy is disabled; this records the direct peer and never reads X-Forwarded-For.
      auditIp: request.ip ?? '',
      type: body.type,
      description: body.description,
      operationId: body.operationId,
    });
  }

  @Post('emergencies')
  @HttpCode(HttpStatus.CREATED)
  @ApiModelResponse(IncidentResponse, false, HttpStatus.CREATED)
  createEmergency(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: CreateEmergencyDto,
  ): Promise<IncidentRecord> {
    return this.incidents.create({
      userId: principal.userId, auditIp: request.ip ?? '', type: 'PANICO',
      description: body.description, operationId: body.operationId,
      latitude: body.latitude, longitude: body.longitude,
    });
  }

  @Get('me/history')
  @ApiItemsPaginationResponse(IncidentResponse)
  getMyHistory(
    @CurrentAuth() principal: AuthPrincipal,
    @Query() query: IncidentHistoryQueryDto,
  ): Promise<IncidentHistoryPage> {
    return this.incidents.findHistoryForUser(principal.userId, query);
  }

  @Get(':id')
  @ApiModelResponse(IncidentResponse)
  getById(
    @CurrentAuth() principal: AuthPrincipal,
    @Param() params: IncidentIdParamDto,
  ): Promise<IncidentRecord> {
    return this.incidents.findByIdForUser(params.id, principal.userId);
  }
}
