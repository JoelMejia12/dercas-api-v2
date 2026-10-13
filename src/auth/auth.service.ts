import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseNotConfiguredError } from '../database/database.service';
import { AccessTokenService } from './access-token.service';
import { AuthIdentityChangedError, AuthRepository } from './auth.repository';
import { OpaqueTokenService } from './opaque-token.service';
import { PasswordHasher } from './password-hasher.service';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const INVALID_CREDENTIALS = 'Invalid credentials';
export interface TokenPair { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number; sessionId: string }

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash?: Promise<string>;

  constructor(private readonly repository: AuthRepository, private readonly passwords: PasswordHasher,
    private readonly opaqueTokens: OpaqueTokenService, private readonly accessTokens: AccessTokenService) {}

  async onModuleInit(): Promise<void> {
    await this.getDummyPasswordHash();
  }

  async login(email: string, password: string, deviceId: string, deviceToken: string, ip?: string): Promise<TokenPair> {
    this.accessTokens.assertConfigured();
    const [user, device] = await Promise.all([this.repository.findUser(email), this.repository.findDevice(deviceId)]);
    let passwordValid = false;
    try {
      const hash = user?.password_hash ?? await this.getDummyPasswordHash();
      passwordValid = await this.passwords.verify(password, hash);
    } catch { passwordValid = false; }
    const deviceValid = Boolean(device && device.activo && this.opaqueTokens.verify(deviceToken, device.device_token_hash));
    if (!user || !device || !user.activo || !passwordValid || !deviceValid) throw new UnauthorizedException(INVALID_CREDENTIALS);
    const refresh = this.opaqueTokens.issue();
    try {
      const session = await this.repository.createSession(user.id, deviceId, refresh.tokenHash, ip,
        user.password_hash, device.device_token_hash);
      return this.pair(user.id, session.id, deviceId, refresh.token);
    } catch (error) {
      if (error instanceof AuthIdentityChangedError) throw new UnauthorizedException(INVALID_CREDENTIALS);
      if (isOpenDeviceSessionConflict(error)) throw new ConflictException('Device already has an open session');
      if (error instanceof DatabaseNotConfiguredError) throw error;
      throw error;
    }
  }

  async refresh(sessionId: string, refreshToken: string): Promise<TokenPair> {
    this.accessTokens.assertConfigured();
    const oldHash = this.opaqueTokens.hash(refreshToken);
    const session = await this.repository.findRefreshSession(sessionId, oldHash, REFRESH_TTL_SECONDS);
    if (!session) throw new UnauthorizedException();
    const next = this.opaqueTokens.issue();
    const rotated = await this.repository.rotateRefresh(sessionId, oldHash, next.tokenHash, REFRESH_TTL_SECONDS);
    if (!rotated) throw new UnauthorizedException();
    return this.pair(session.usuario_id, session.id, session.dispositivo_id, next.token);
  }

  async revoke(sessionId: string, userId: string, ip?: string): Promise<void> {
    await this.repository.revoke(sessionId, userId, ip);
  }

  async logout(sessionId: string, userId: string, ip?: string): Promise<void> {
    await this.repository.closeSession(sessionId, userId, ip);
  }

  private pair(userId: string, sessionId: string, deviceId: string, refreshToken: string): TokenPair {
    return { accessToken: this.accessTokens.issue(userId, sessionId, deviceId), refreshToken,
      tokenType: 'Bearer', expiresIn: 900, sessionId };
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= this.passwords.hash(randomBytes(32).toString('base64url'));
    return this.dummyPasswordHash;
  }
}

function isOpenDeviceSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const pgError = error as { code?: unknown; constraint?: unknown };
  return pgError.code === '23505' && pgError.constraint === 'uq_sesion_dispositivo_abierta';
}
