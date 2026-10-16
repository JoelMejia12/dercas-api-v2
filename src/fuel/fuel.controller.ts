import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FuelHistoryQueryDto } from './fuel-history-query.dto';
import { FuelHistoryPage, FuelService } from './fuel.service';
import { CreateFuelDto } from './create-fuel.dto';
import { FuelChargeRecord } from './fuel.repository';
import { LoanIdParamDto } from '../loans/loan-id-param.dto';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { FuelChargeResponse, FuelHistoryResponse } from '../openapi/domain-response.models';

@Controller('fuel')
@ApiAuthenticated('Fuel')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('COMBUSTIBLE_REPORTAR')
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get('me/history')
  @RequirePermissions('COMBUSTIBLE_REPORTAR')
  @ApiItemsPaginationResponse(FuelHistoryResponse)
  getMyHistory(
    @CurrentAuth() principal: AuthPrincipal,
    @Query() query: FuelHistoryQueryDto,
  ): Promise<FuelHistoryPage> {
    return this.fuel.findHistoryForUser(principal.userId, query.limit, query.offset);
  }

  @Get(':id')
  @ApiModelResponse(FuelHistoryResponse)
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: LoanIdParamDto) {
    return this.fuel.findByIdForUser(params.id, principal.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiModelResponse(FuelChargeResponse, false, HttpStatus.CREATED)
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Req() request: Request,
    @Body() body: CreateFuelDto,
  ): Promise<FuelChargeRecord> {
    return this.fuel.create({ ...body, userId: principal.userId, auditIp: request.ip ?? '' });
  }
}
