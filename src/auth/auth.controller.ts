import { Body, Controller, Header, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto, RefreshDto, TokenPairDto } from './auth.dto';
import { AuthGuard } from './auth.guard';
import { CurrentAuth } from './auth.decorators';
import { AuthPrincipal } from './auth.types';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('sessions') @HttpCode(HttpStatus.CREATED) @Header('Cache-Control', 'no-store') @ApiCreatedResponse({ type: TokenPairDto })
  login(@Body() body: LoginDto, @Req() request: Request): Promise<TokenPair> {
    return this.auth.login(body.email, body.password, body.deviceId, body.deviceToken, request.ip);
  }
  @Post('sessions/refresh') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: TokenPairDto })
  refresh(@Body() body: RefreshDto): Promise<TokenPair> { return this.auth.refresh(body.sessionId, body.refreshToken); }
  @Post('sessions/revoke') @HttpCode(HttpStatus.NO_CONTENT) @UseGuards(AuthGuard) @ApiBearerAuth('accessToken')
  async revoke(@CurrentAuth() principal: AuthPrincipal, @Req() request: Request): Promise<void> {
    await this.auth.revoke(principal.sessionId, principal.userId, request.ip);
  }
  @Post('sessions/logout') @HttpCode(HttpStatus.NO_CONTENT) @UseGuards(AuthGuard) @ApiBearerAuth('accessToken')
  async logout(@CurrentAuth() principal: AuthPrincipal, @Req() request: Request): Promise<void> {
    await this.auth.logout(principal.sessionId, principal.userId, request.ip);
  }
}
