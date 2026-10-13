export interface AuthPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly permissions: readonly string[];
}

export const AUTH_PRINCIPAL = 'authPrincipal';

export interface AuthRequest {
  headers: { authorization?: string };
  authPrincipal?: AuthPrincipal;
}

export interface SessionRecord {
  readonly id: string;
  readonly usuario_id: string;
  readonly dispositivo_id: string;
  readonly estado: string;
  readonly login_at: Date;
  readonly refresh_token_hash: string | null;
}
