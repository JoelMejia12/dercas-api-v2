import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ActiveAssignment } from './assignment.repository';
import { AssignmentHistoryPage, AssignmentService } from './assignment.service';
import { AssignmentHistoryQueryDto } from './assignment-history-query.dto';
import { AssignmentIdParamDto } from './assignment-id-param.dto';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { ActiveAssignmentResponse, AssignmentItemResponse } from '../openapi/domain-response.models';
import { JsonNullInterceptor } from '../common/http/json-null.interceptor';

@Controller('assignments')
@ApiAuthenticated('Assignments')
@UseGuards(AuthGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentService) {}

  @Get('me/active')
  @UseInterceptors(JsonNullInterceptor)
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiModelResponse(ActiveAssignmentResponse, true)
  getMyActiveAssignment(@CurrentAuth() principal: AuthPrincipal): Promise<ActiveAssignment | null> {
    return this.assignments.findCurrentForAuthenticatedPilot(principal.userId);
  }

  @Get('me/history')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiItemsPaginationResponse(AssignmentItemResponse)
  getMyHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: AssignmentHistoryQueryDto): Promise<AssignmentHistoryPage> {
    return this.assignments.findHistoryForAuthenticatedPilot(principal.userId, query.limit, query.offset);
  }

  @Get('me/:id')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  @ApiModelResponse(AssignmentItemResponse)
  getMyById(@CurrentAuth() principal: AuthPrincipal, @Param() params: AssignmentIdParamDto) {
    return this.assignments.findByIdForAuthenticatedPilot(params.id, principal.userId);
  }
}
