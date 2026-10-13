import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators';
import { PermissionsGuard } from '../auth/permissions.guard';
import { UserIdParamDto, UsersListQueryDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMyProfile(@CurrentAuth() principal: AuthPrincipal) { return this.users.getMyProfile(principal.userId); }

  @Get('me/access')
  getMyAccess(@CurrentAuth() principal: AuthPrincipal) { return this.users.getMyAccess(principal.userId); }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  listUsers(@Query() query: UsersListQueryDto) { return this.users.listUsers(query); }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  getUser(@Param() params: UserIdParamDto) { return this.users.getUser(params.id); }

  @Get(':id/access')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('USUARIOS_ADMINISTRAR')
  getUserAccess(@Param() params: UserIdParamDto) { return this.users.getUserAccess(params.id); }
}
