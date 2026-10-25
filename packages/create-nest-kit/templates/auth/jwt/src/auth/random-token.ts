import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** 256 random bits, URL-safe: refresh, verification and reset secrets. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Tokens are stored only as SHA-256 hashes. The tokens are random, so a fast hash is enough,
 * and unlike a salted password hash it can be looked up by an index.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
