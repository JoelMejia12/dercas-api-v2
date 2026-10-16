import { Module } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { OpaqueTokenService } from './opaque-token.service';
import { PasswordHasher } from './password-hasher.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  controllers: [AuthController],
  providers: [PasswordHasher, OpaqueTokenService, AccessTokenService, AuthRepository, AuthService, AuthGuard, PermissionsGuard],
  exports: [PasswordHasher, OpaqueTokenService, AccessTokenService, AuthRepository, AuthGuard, PermissionsGuard],
})
export class AuthModule {}
