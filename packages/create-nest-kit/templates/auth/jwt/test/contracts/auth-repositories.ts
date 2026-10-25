import type { RefreshTokensRepository } from '../../src/auth/refresh-tokens.repository.js';
import {
  type NewVerificationToken,
  VerificationPurpose,
  type VerificationTokensRepository,
} from '../../src/auth/verification-tokens.repository.js';
import type { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import type { UsersRepository } from '../../src/modules/users/users.repository.js';
import { hoursFrom, NOW } from './repositories.js';

/** The auth repositories, plus the domain ones their rows reference. */
export interface AuthRepositories {
  users: UsersRepository;
  sessions: SessionsRepository;
  refreshTokens: RefreshTokensRepository;
  verificationTokens: VerificationTokensRepository;
}

/** Called before each contract test; returns repositories over an empty store. */
export type AuthRepositoriesFactory = () => Promise<AuthRepositories>;

export function aVerificationToken(
  userId: string,
  overrides: Partial<NewVerificationToken> = {},
): NewVerificationToken {
  return {
    userId,
    purpose: VerificationPurpose.PasswordReset,
    tokenHash: 'reset-hash',
    createdAt: NOW,
    expiresAt: hoursFrom(NOW, 1),
    ...overrides,
  };
}
