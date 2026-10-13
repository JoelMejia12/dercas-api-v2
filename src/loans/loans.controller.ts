import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { LoanHistoryQueryDto } from './loan-history-query.dto';
import { LoanReadItem } from './loan-read.repository';
import { LoanHistoryPage, LoanReadService } from './loan-read.service';

@Controller('loans/me')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
export class LoansController {
  constructor(private readonly loans: LoanReadService) {}

  @Get('active')
  getActive(@CurrentAuth() principal: AuthPrincipal): Promise<readonly LoanReadItem[]> {
    return this.loans.findActiveForUser(principal.userId);
  }

  @Get('history')
  getHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: LoanHistoryQueryDto): Promise<LoanHistoryPage> {
    return this.loans.findHistoryForUser(principal.userId, query.limit, query.offset);
  }

  @Get('available-vehicles')
  getAvailableVehicles(@Query() query: LoanHistoryQueryDto) {
    return this.loans.findAvailableAdministrativeVehicles(query.limit, query.offset);
  }
}
