import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ActiveAssignment } from './assignment.repository';
import { AssignmentHistoryPage, AssignmentService } from './assignment.service';
import { AssignmentHistoryQueryDto } from './assignment-history-query.dto';
import { AssignmentIdParamDto } from './assignment-id-param.dto';

@Controller('assignments')
@UseGuards(AuthGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentService) {}

  @Get('me/active')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getMyActiveAssignment(@CurrentAuth() principal: AuthPrincipal): Promise<ActiveAssignment | null> {
    return this.assignments.findCurrentForAuthenticatedPilot(principal.userId);
  }

  @Get('me/history')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getMyHistory(@CurrentAuth() principal: AuthPrincipal, @Query() query: AssignmentHistoryQueryDto): Promise<AssignmentHistoryPage> {
    return this.assignments.findHistoryForAuthenticatedPilot(principal.userId, query.limit, query.offset);
  }

  @Get('me/:id')
  @RequirePermissions('VEHICULO_USAR_ASIGNADO')
  getMyById(@CurrentAuth() principal: AuthPrincipal, @Param() params: AssignmentIdParamDto) {
    return this.assignments.findByIdForAuthenticatedPilot(params.id, principal.userId);
  }
}
