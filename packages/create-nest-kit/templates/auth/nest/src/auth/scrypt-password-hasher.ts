import { Injectable } from '@nestjs/common';
import { PasswordHasher as OfficialPasswordHasher } from '@nestjs/authentication';
import { PasswordHasher } from './password-hasher.js';

/**
 * The domain's `PasswordHasher` over `@nestjs/authentication`'s scrypt hasher (configured by the
 * `password` option of AuthenticationModule), so users and password resets share one format.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly scrypt: OfficialPasswordHasher) {}

  hash(plain: string): Promise<string> {
    return this.scrypt.hash(plain);
  }

  verify(plain: string, passwordHash: string | null): Promise<boolean> {
    // `undefined` makes it check a dummy hash, so an unknown user takes as long as a wrong password.
    return this.scrypt.verify(plain, passwordHash ?? undefined);
  }
}
