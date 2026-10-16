import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, AuthRequest } from './auth.types';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) => applyDecorators(
  SetMetadata(REQUIRED_PERMISSIONS, permissions),
  ApiExtension('x-required-permissions', permissions),
);
export const ApiAuthenticated = (tag: string) => applyDecorators(ApiTags(tag), ApiBearerAuth('accessToken'));
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  const principal = context.switchToHttp().getRequest<AuthRequest>().authPrincipal;
  if (!principal) throw new UnauthorizedException();
  return principal;
});
