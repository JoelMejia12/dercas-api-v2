import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';
import { OdometerHistoryPage, OdometerService } from './odometer.service';
import { LoanIdParamDto } from '../loans/loan-id-param.dto';

@Controller('odometer')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ASIGNADO')
export class OdometerController {
  constructor(private readonly odometer: OdometerService) {}

  @Get('me/history')
  getMyHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: OdometerHistoryQueryDto): Promise<OdometerHistoryPage> {
    return this.odometer.findHistoryForUser(principal.userId, query);
  }

  @Get(':id')
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: LoanIdParamDto) {
    return this.odometer.findByIdForUser(params.id, principal.userId);
  }
}
