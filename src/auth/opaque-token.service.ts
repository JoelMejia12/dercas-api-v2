import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface IssuedOpaqueToken {
  /** Return to the client once; persist only tokenHash. */
  readonly token: string;
  readonly tokenHash: string;
}

@Injectable()
export class OpaqueTokenService {
  issue(): IssuedOpaqueToken {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  verify(token: string, expectedHash: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
    const actual = Buffer.from(this.hash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return timingSafeEqual(actual, expected);
  }
}
