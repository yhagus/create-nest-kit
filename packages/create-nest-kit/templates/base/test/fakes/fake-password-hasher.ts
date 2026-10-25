import type { PasswordHasher } from '../../src/auth/password-hasher.js';

/** Readable, instant "hashes" for unit tests: `hash('secret')` is `'hashed:secret'`. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hash: string | null): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}
