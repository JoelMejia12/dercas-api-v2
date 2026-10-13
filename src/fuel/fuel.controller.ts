import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FuelHistoryQueryDto } from './fuel-history-query.dto';
import { FuelHistoryPage, FuelService } from './fuel.service';
import { CreateFuelDto } from './create-fuel.dto';
import { FuelChargeRecord } from './fuel.repository';
import { LoanIdParamDto } from '../loans/loan-id-param.dto';

@Controller('fuel')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('COMBUSTIBLE_REPORTAR')
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get('me/history')
  @RequirePermissions('COMBUSTIBLE_REPORTAR')
  getMyHistory(
    @CurrentAuth() principal: AuthPrincipal,
    @Query() query: FuelHistoryQueryDto,
  ): Promise<FuelHistoryPage> {
    return this.fuel.findHistoryForUser(principal.userId, query.limit, query.offset);
  }

  @Get(':id')
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: LoanIdParamDto) {
    return this.fuel.findByIdForUser(params.id, principal.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: CreateFuelDto,
  ): Promise<FuelChargeRecord> {
    return this.fuel.create({ ...body, userId: principal.userId, auditIp: request.ip ?? '' });
  }
}
