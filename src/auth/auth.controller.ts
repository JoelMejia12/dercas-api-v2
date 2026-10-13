import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto, RefreshDto } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { CurrentAuth } from './auth.decorators';
import { AuthPrincipal } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('sessions') @HttpCode(HttpStatus.CREATED) @Header('Cache-Control', 'no-store')
  login(@Body() body: LoginDto, @Req() request: Request): Promise<TokenPair> {
    return this.auth.login(body.email, body.password, body.deviceId, body.deviceToken, request.ip);
  }
  @Post('sessions/refresh') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store')
  refresh(@Body() body: RefreshDto): Promise<TokenPair> { return this.auth.refresh(body.sessionId, body.refreshToken); }
  @Post('sessions/revoke') @HttpCode(HttpStatus.NO_CONTENT) @UseGuards(AuthGuard)
  async revoke(@CurrentAuth() principal: AuthPrincipal, @Req() request: Request): Promise<void> {
    await this.auth.revoke(principal.sessionId, principal.userId, request.ip);
  }
  @Post('sessions/logout') @HttpCode(HttpStatus.NO_CONTENT) @UseGuards(AuthGuard)
  async logout(@CurrentAuth() principal: AuthPrincipal, @Req() request: Request): Promise<void> {
    await this.auth.logout(principal.sessionId, principal.userId, request.ip);
  }
}
