import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { AuthPrincipal, AuthRequest } from './auth.types';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  const principal = context.switchToHttp().getRequest<AuthRequest>().authPrincipal;
  if (!principal) throw new UnauthorizedException();
  return principal;
});
