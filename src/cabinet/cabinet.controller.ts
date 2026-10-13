import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CabinetEventQueryDto, CabinetIdParamDto, CabinetListQueryDto } from './cabinet.dto';
import { CabinetService } from './cabinet.service';

@Controller('cabinet')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('GABINETE_VER')
export class CabinetController {
  constructor(private readonly cabinet: CabinetService) {}
  @Get() findCabinets(@Query() query: CabinetListQueryDto) { return this.cabinet.findCabinets(query); }
  @Get('keyrings') findKeyrings(@Query() query: CabinetListQueryDto) { return this.cabinet.findKeyrings(query); }
  @Get('events') findEvents(@Query() query: CabinetEventQueryDto) { return this.cabinet.findEvents(query); }
  @Get(':id/positions') findPositions(@Param() params: CabinetIdParamDto) { return this.cabinet.findPositions(params.id); }
}
