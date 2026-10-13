import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const MAX_PASSWORD_BYTES = 1024;

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    this.validateInput(password);
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    this.validateInput(password);
    if (!passwordHash.startsWith('$argon2id$')) return false;
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private validateInput(password: string): void {
    if (typeof password !== 'string' || password.length === 0) {
      throw new TypeError('Password must be a non-empty string');
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new RangeError('Password exceeds the supported input size');
    }
  }
}
