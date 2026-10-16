import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthPrincipal } from '../auth/auth.types';
import { ApiAuthenticated, CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { UserIdParamDto, UsersListQueryDto } from './users.dto';
import { UsersService } from './users.service';
import { ApiItemsPaginationResponse, ApiModelResponse } from '../openapi/response.decorators';
import { UserAccessResponse, UserProfileResponse } from '../openapi/domain-response.models';

@Controller('users')
@ApiAuthenticated('Users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiModelResponse(UserProfileResponse)
  getMyProfile(@CurrentAuth() principal: AuthPrincipal) { return this.users.getMyProfile(principal.userId); }

  @Get('me/access')
  @ApiModelResponse(UserAccessResponse)
  getMyAccess(@CurrentAuth() principal: AuthPrincipal) { return this.users.getMyAccess(principal.userId); }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  @ApiItemsPaginationResponse(UserProfileResponse)
  listUsers(@Query() query: UsersListQueryDto) { return this.users.listUsers(query); }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  @ApiModelResponse(UserProfileResponse)
  getUser(@Param() params: UserIdParamDto) { return this.users.getUser(params.id); }

  @Get(':id/access')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  @ApiModelResponse(UserAccessResponse)
  getUserAccess(@Param() params: UserIdParamDto) { return this.users.getUserAccess(params.id); }
}
