import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AuthPrincipal } from '../auth/auth.types';
import { AssignedVehicle } from './vehicle.repository';
import { VehicleService } from './vehicle.service';
import { VehicleIdParamDto, VehiclePageQueryDto } from './vehicle-query.dto';

@Controller('vehicles')
@UseGuards(AuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get('assigned')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getCurrentUserVehicle(@CurrentAuth() principal: AuthPrincipal): Promise<AssignedVehicle | null> {
    return this.vehicles.findCurrentUserVehicle(principal.userId);
  }

  @Get('me/assignments')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getMyAssignmentHistory(@CurrentAuth() principal: AuthPrincipal) {
    return this.vehicles.findMyAssignmentHistory(principal.userId);
  }

  @Get('assigned/maintenance-status')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getAssignedVehicleMaintenanceStatus(@CurrentAuth() principal: AuthPrincipal) {
    return this.vehicles.findAssignedVehicleMaintenanceStatus(principal.userId);
  }

  @Get('administrative/available')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  getAdministrativeAvailability(@Query() query: VehiclePageQueryDto) {
    return this.vehicles.findAdministrativeAvailable(query);
  }

  @Get('administrative/available/:id')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  getAvailableAdministrativeVehicle(@Param() params: VehicleIdParamDto) {
    return this.vehicles.findAvailableAdministrativeVehicle(params.id);
  }
}
