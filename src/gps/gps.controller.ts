import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { GpsArchiveQueryDto, GpsDeviceIdParamDto, GpsPageQueryDto, GpsPositionHistoryQueryDto, GpsSessionIdParamDto, GpsVehicleIdParamDto } from './gps-read.dto';
import { GpsReadRepository } from './gps-read.repository';
import { GpsReadService } from './gps-read.service';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { GpsArchiveResponse, GpsConfigurationResponse, GpsDeviceStatusResponse, GpsLatestResponse, GpsManagedDeviceDiagnosticResponse, GpsManagedDeviceResponse, GpsPointResponse, GpsProfileResponse, GpsRealtimeVehicleResponse, GpsRestorationResponse, GpsRetentionResponse, GpsSessionResponse } from '../openapi/domain-response.models';
import { JsonNullInterceptor } from '../common/http/json-null.interceptor';

@Controller('gps')
@ApiAuthenticated('GPS')
@UseGuards(AuthGuard)
export class GpsController {
  constructor(private readonly gps: GpsReadService, private readonly repository: GpsReadRepository) {}

  @Get('me/latest')
  @UseInterceptors(JsonNullInterceptor)
  @ApiModelResponse(GpsLatestResponse, true)
  getMyLatest(@CurrentAuth() principal: AuthPrincipal) { return this.repository.findMyLatest(principal.userId); }

  @Get('me/device-status')
  @UseInterceptors(JsonNullInterceptor)
  @ApiModelResponse(GpsDeviceStatusResponse, true)
  async getMyDeviceStatus(@CurrentAuth() principal: AuthPrincipal) {
    return this.repository.findOwnDeviceStatus(principal.deviceId);
  }

  @Get('me/sessions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiItemsPaginationResponse(GpsSessionResponse)
  getMySessions(@CurrentAuth() principal: AuthPrincipal, @Query() query: GpsPageQueryDto) {
    return this.gps.findMySessions(principal.userId, query);
  }

  @Get('me/sessions/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiModelResponse(GpsSessionResponse)
  getMySession(@CurrentAuth() principal: AuthPrincipal, @Param() params: GpsSessionIdParamDto) {
    return this.gps.findMySession(params.id, principal.userId);
  }

  @Get('me/sessions/:id/positions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiItemsPaginationResponse(GpsPointResponse)
  getMySessionPositions(@CurrentAuth() principal: AuthPrincipal, @Param() params: GpsSessionIdParamDto, @Query() query: GpsPositionHistoryQueryDto) {
    return this.gps.findMySessionPositions(params.id, principal.userId, query);
  }

  @Get('me/restorations')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiItemsPaginationResponse(GpsRestorationResponse)
  getMyRestorations(@CurrentAuth() principal: AuthPrincipal, @Query() query: GpsPageQueryDto) {
    return this.gps.findMyRestorations(principal.userId, query);
  }

  @Get('me/restorations/:id/positions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiItemsPaginationResponse(GpsPointResponse)
  getRestorationPositions(@CurrentAuth() principal: AuthPrincipal, @Param() params: GpsSessionIdParamDto, @Query() query: GpsPositionHistoryQueryDto) {
    return this.gps.findRestorationPositions(params.id, principal.userId, query);
  }

  @Get('vehicles/latest')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_VER_TIEMPO_REAL')
  @ApiItemsPaginationResponse(GpsRealtimeVehicleResponse)
  getLatestByVehicle(@Query() query: GpsPageQueryDto) { return this.gps.findRealtimeMap(query); }

  @Get('vehicles/:vehicleId/positions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_HISTORICO_VER')
  @ApiItemsPaginationResponse(GpsPointResponse)
  getVehiclePositionHistory(@Param() params: GpsVehicleIdParamDto, @Query() query: GpsPositionHistoryQueryDto) {
    return this.gps.findVehiclePositions(params.vehicleId, query);
  }

  @Get('devices')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('DISPOSITIVOS_ADMINISTRAR')
  @ApiItemsPaginationResponse(GpsManagedDeviceResponse)
  getManagedDevices(@Query() query: GpsPageQueryDto) { return this.gps.findManagedDevices(query); }

  @Get('devices/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('DISPOSITIVOS_ADMINISTRAR')
  @ApiModelResponse(GpsManagedDeviceDiagnosticResponse)
  getManagedDevice(@Param() params: GpsDeviceIdParamDto) { return this.gps.findManagedDevice(params.id); }

  @Get('configuration')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_ADMINISTRAR')
  @ApiModelResponse(GpsConfigurationResponse)
  getConfiguration() { return this.gps.findConfiguration(); }

  @Get('profiles')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_ADMINISTRAR')
  @ApiItemsPaginationResponse(GpsProfileResponse)
  async getProfiles(@Query() query: GpsPageQueryDto) {
    const page = await this.repository.findProfiles(query);
    return { items: page.items, pagination: { limit: query.limit, offset: query.offset, hasMore: page.hasMore } };
  }

  @Get('archives')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_ARCHIVAR')
  @ApiItemsPaginationResponse(GpsArchiveResponse)
  getArchives(@Query() query: GpsArchiveQueryDto) { return this.gps.findArchives(query); }

  @Get('retention')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('GPS_ARCHIVAR')
  @ApiModelResponse(GpsRetentionResponse)
  getRetention() { return this.gps.findRetention(); }
}
