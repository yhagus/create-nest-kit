import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes with argon2id', async () => {
    expect(await hasher.hash('correct horse')).toMatch(/^\$argon2id\$/);
  });

  it('rejects every password when there is no hash', async () => {
    expect(await hasher.verify('correct horse', null)).toBe(false);
  });
});
