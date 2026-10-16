import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CabinetEventQueryDto, CabinetIdParamDto, CabinetListQueryDto } from './cabinet.dto';
import { CabinetService } from './cabinet.service';
import { ApiArrayResponse, ApiItemsPaginationResponse } from '../openapi/response.decorators';
import { CabinetEventResponse, CabinetKeyringResponse, CabinetPositionResponse, CabinetResponse } from '../openapi/domain-response.models';

@Controller('cabinet')
@ApiAuthenticated('Cabinet')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('GABINETE_VER')
export class CabinetController {
  constructor(private readonly cabinet: CabinetService) {}
  @Get() @ApiItemsPaginationResponse(CabinetResponse) findCabinets(@Query() query: CabinetListQueryDto) { return this.cabinet.findCabinets(query); }
  @Get('keyrings') @ApiItemsPaginationResponse(CabinetKeyringResponse) findKeyrings(@Query() query: CabinetListQueryDto) { return this.cabinet.findKeyrings(query); }
  @Get('events') @ApiItemsPaginationResponse(CabinetEventResponse) findEvents(@Query() query: CabinetEventQueryDto) { return this.cabinet.findEvents(query); }
  @Get(':id/positions') @ApiArrayResponse(CabinetPositionResponse) findPositions(@Param() params: CabinetIdParamDto) { return this.cabinet.findPositions(params.id); }
}
