import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AuthPrincipal } from '../auth/auth.types';
import { AssignedVehicle } from './vehicle.repository';
import { VehicleService } from './vehicle.service';
import { VehicleIdParamDto, VehiclePageQueryDto } from './vehicle-query.dto';
import { ApiArrayResponse, ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { AdministrativeAvailableVehicleResponse, AssignedVehicleResponse, VehicleAssignmentHistoryResponse, VehicleMaintenanceStatusResponse } from '../openapi/domain-response.models';
import { JsonNullInterceptor } from '../common/http/json-null.interceptor';

@Controller('vehicles')
@ApiAuthenticated('Vehicles')
@UseGuards(AuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get('assigned')
  @UseInterceptors(JsonNullInterceptor)
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiModelResponse(AssignedVehicleResponse, true)
  getCurrentUserVehicle(@CurrentAuth() principal: AuthPrincipal): Promise<AssignedVehicle | null> {
    return this.vehicles.findCurrentUserVehicle(principal.userId);
  }

  @Get('me/assignments')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiArrayResponse(VehicleAssignmentHistoryResponse)
  getMyAssignmentHistory(@CurrentAuth() principal: AuthPrincipal) {
    return this.vehicles.findMyAssignmentHistory(principal.userId);
  }

  @Get('assigned/maintenance-status')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiArrayResponse(VehicleMaintenanceStatusResponse)
  getAssignedVehicleMaintenanceStatus(@CurrentAuth() principal: AuthPrincipal) {
    return this.vehicles.findAssignedVehicleMaintenanceStatus(principal.userId);
  }

  @Get('administrative/available')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  @ApiItemsPaginationResponse(AdministrativeAvailableVehicleResponse)
  getAdministrativeAvailability(@Query() query: VehiclePageQueryDto) {
    return this.vehicles.findAdministrativeAvailable(query);
  }

  @Get('administrative/available/:id')
  @RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
  @ApiModelResponse(AdministrativeAvailableVehicleResponse, true)
  getAvailableAdministrativeVehicle(@Param() params: VehicleIdParamDto) {
    return this.vehicles.findAvailableAdministrativeVehicle(params.id);
  }
}
