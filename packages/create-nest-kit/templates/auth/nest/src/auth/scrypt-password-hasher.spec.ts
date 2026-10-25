import { PasswordHasher as OfficialPasswordHasher } from '@nestjs/authentication';
import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  // The lowest cost scrypt accepts, to keep the test fast.
  const hasher = new ScryptPasswordHasher(new OfficialPasswordHasher({ logN: 10 }));

  it('hashes with scrypt', async () => {
    expect(await hasher.hash('correct horse')).toMatch(/^\$scrypt\$/);
  });

  it('rejects every password when there is no hash', async () => {
    expect(await hasher.verify('correct horse', null)).toBe(false);
  });
});
