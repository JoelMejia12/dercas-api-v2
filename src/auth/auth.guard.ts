import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { AuthRepository } from './auth.repository';
import { AuthRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: AccessTokenService, private readonly repository: AuthRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    const claims = this.tokens.verify(match[1]!);
    const permissions = await this.repository.findActivePrincipal(claims.sub, claims.sid, claims.did);
    if (!permissions) throw new UnauthorizedException();
    request.authPrincipal = { userId: claims.sub, sessionId: claims.sid, deviceId: claims.did, permissions };
    return true;
  }
}
