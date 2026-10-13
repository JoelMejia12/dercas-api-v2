import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateMaintenanceOrderDto, MaintenanceOrderHistoryQueryDto, MaintenanceOrderIdParamDto } from './maintenance.dto';
import {
  CreateMaintenanceOrderInput,
  MaintenanceAlertRecord,
  MaintenanceOrderRecord,
  MaintenancePlanStatus,
} from './maintenance.repository';
import { MaintenanceOrderPage, MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ASIGNADO')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('me/orders')
  getMyVehicleOrders(
    @CurrentAuth() principal: AuthPrincipal,
    @Query() query: MaintenanceOrderHistoryQueryDto,
  ): Promise<MaintenanceOrderPage> {
    return this.maintenance.findOrdersForCurrentVehicle(principal.userId, query);
  }

  @Get('me/orders/:id')
  getMyVehicleOrder(
    @CurrentAuth() principal: AuthPrincipal,
    @Param() params: MaintenanceOrderIdParamDto,
  ): Promise<MaintenanceOrderRecord> {
    return this.maintenance.findOrderByIdForCurrentVehicle(params.id, principal.userId);
  }

  @Get('me/plans')
  getMyVehiclePlans(@CurrentAuth() principal: AuthPrincipal): Promise<readonly MaintenancePlanStatus[]> {
    return this.maintenance.findPlansForCurrentVehicle(principal.userId);
  }

  @Get('me/alerts')
  getMyVehicleAlerts(@CurrentAuth() principal: AuthPrincipal): Promise<readonly MaintenanceAlertRecord[]> {
    return this.maintenance.findAlertsForCurrentVehicle(principal.userId);
  }

  @Post('me/orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('MANTENIMIENTO_CREAR')
  createOrder(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: CreateMaintenanceOrderDto,
  ): Promise<MaintenanceOrderRecord> {
    const input: CreateMaintenanceOrderInput = {
      userId: principal.userId,
      auditIp: request.ip ?? '',
      reason: body.reason,
      observations: body.observations,
    };
    return this.maintenance.createOrder(input);
  }
}
