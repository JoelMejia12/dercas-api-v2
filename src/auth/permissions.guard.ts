import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from './auth.decorators';
import { AuthRequest } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]);
    const principal = context.switchToHttp().getRequest<AuthRequest>().authPrincipal;
    if (!required?.length || !principal || !required.every((permission) => principal.permissions.includes(permission))) throw new ForbiddenException();
    return true;
  }
}
