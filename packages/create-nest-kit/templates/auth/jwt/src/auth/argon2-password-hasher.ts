import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from './password-hasher.js';

/** argon2id with the library defaults (19 MiB, 2 passes, 1 lane): OWASP's recommended minimum. */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  /** Checked when there is no user, so "unknown email" takes as long as "wrong password". */
  private readonly unknownUserHash = hash(randomBytes(32).toString('base64url'));

  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(plain: string, passwordHash: string | null): Promise<boolean> {
    if (passwordHash === null) {
      await verify(await this.unknownUserHash, plain);
      return false;
    }
    return verify(passwordHash, plain);
  }
}
