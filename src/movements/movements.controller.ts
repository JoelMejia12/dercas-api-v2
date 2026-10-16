import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MovementHistoryQueryDto, MovementIdParamDto } from './movement-query.dto';
import { MovementsService } from './movements.service';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { MovementResponse } from '../openapi/domain-response.models';

@Controller('movements/me')
@ApiAuthenticated('Movements')
@UseGuards(AuthGuard, PermissionsGuard)
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  @Get('assigned')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiItemsPaginationResponse(MovementResponse)
  assignedHistory(@CurrentAuth() auth: AuthPrincipal, @Query() query: MovementHistoryQueryDto) {
    return this.movements.findHistory(auth.userId, 'assigned', query);
  }

  @Get('assigned/open')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiModelResponse(MovementResponse)
  assignedOpen(@CurrentAuth() auth: AuthPrincipal) { return this.movements.findOpen(auth.userId, 'assigned'); }

  @Get('assigned/:id')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiModelResponse(MovementResponse)
  assignedById(@CurrentAuth() auth: AuthPrincipal, @Param() params: MovementIdParamDto) {
    return this.movements.findById(auth.userId, params.id, 'assigned');
  }

  @Get('administrative')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  @ApiItemsPaginationResponse(MovementResponse)
  administrativeHistory(@CurrentAuth() auth: AuthPrincipal, @Query() query: MovementHistoryQueryDto) {
    return this.movements.findHistory(auth.userId, 'administrative', query);
  }

  @Get('administrative/open')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  @ApiModelResponse(MovementResponse)
  administrativeOpen(@CurrentAuth() auth: AuthPrincipal) { return this.movements.findOpen(auth.userId, 'administrative'); }

  @Get('administrative/:id')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  @ApiModelResponse(MovementResponse)
  administrativeById(@CurrentAuth() auth: AuthPrincipal, @Param() params: MovementIdParamDto) {
    return this.movements.findById(auth.userId, params.id, 'administrative');
  }
}
