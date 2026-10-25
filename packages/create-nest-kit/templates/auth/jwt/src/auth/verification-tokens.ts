import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import type { Env } from '../config/env.js';
import { ExpiredDataPurger } from '../infra/queue/expired-data-purger.js';
import { generateToken, hashToken } from './random-token.js';
import {
  type VerificationPurpose,
  VerificationTokensRepository,
} from './verification-tokens.repository.js';

const LIFETIME_ENV_KEYS = {
  email_verification: 'EMAIL_VERIFICATION_TTL',
  password_reset: 'PASSWORD_RESET_TTL',
} as const satisfies Record<VerificationPurpose, keyof Env>;

/** One-time tokens mailed to the user: issued raw, stored hashed, usable once until they expire. */
@Injectable()
@ExpiredDataPurger()
export class VerificationTokens implements ExpiredDataPurger {
  constructor(
    private readonly repository: VerificationTokensRepository,
    private readonly config: AppConfig,
  ) {}

  /** A new token for the user; their earlier tokens of the same purpose stop working. */
  async issue(userId: string, purpose: VerificationPurpose): Promise<string> {
    const token = generateToken();
    const now = new Date();
    const lifetimeMs = this.config.get(LIFETIME_ENV_KEYS[purpose]);
    await this.repository.replace({
      userId,
      purpose,
      tokenHash: hashToken(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + lifetimeMs),
    });
    return token;
  }

  /** Uses up the token and returns its user id; null when it is unknown, expired or used. */
  consume(purpose: VerificationPurpose, token: string): Promise<string | null> {
    return this.repository.consume(purpose, hashToken(token), new Date());
  }

  purgeExpired(now: Date): Promise<number> {
    return this.repository.deleteExpired(now);
  }
}
