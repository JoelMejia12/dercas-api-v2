import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateLoanRequestDto } from './create-loan-request.dto';
import { LoanRequestRecord } from './loan-request.repository';
import { LoanRequestService } from './loan-request.service';
import { LoanIdParamDto } from './loan-id-param.dto';
import { ApiModelResponse } from '../openapi/response.decorators';
import { LoanRequestResponse } from '../openapi/domain-response.models';

@Controller('loans')
@ApiAuthenticated('Loans')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('VEHICULO_USAR_ADMINISTRATIVO')
export class LoanRequestsController {
  constructor(private readonly requests: LoanRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiModelResponse(LoanRequestResponse, false, HttpStatus.CREATED)
  create(
    @CurrentAuth() principal: AuthPrincipal,
    @Body() body: CreateLoanRequestDto,
    @Req() request: Request,
  ): Promise<LoanRequestRecord> {
    return this.requests.create({
      vehicleId: body.vehicleId,
      userId: principal.userId,
      operationId: body.operationId,
      destination: body.destination,
      reason: body.reason,
      // trust proxy is explicitly disabled; this is the direct connection peer, not X-Forwarded-For.
      auditIp: request.ip ?? '',
    });
  }

  @Get(':id')
  @ApiModelResponse(LoanRequestResponse)
  getById(@CurrentAuth() principal: AuthPrincipal, @Param() params: LoanIdParamDto): Promise<LoanRequestRecord> {
    return this.requests.findById(params.id, principal.userId);
  }
}
