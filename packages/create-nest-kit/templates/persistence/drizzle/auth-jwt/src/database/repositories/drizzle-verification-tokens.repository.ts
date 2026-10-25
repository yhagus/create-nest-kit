import { Injectable } from '@nestjs/common';
import { and, eq, gt, lte } from 'drizzle-orm';
import {
  type NewVerificationToken,
  type VerificationPurpose,
  VerificationTokensRepository,
} from '../../auth/verification-tokens.repository.js';
import { type Database, InjectDatabase } from '../database.js';
import { verificationTokens } from '../schema/verification-tokens.js';

@Injectable()
export class DrizzleVerificationTokensRepository implements VerificationTokensRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async replace(token: NewVerificationToken): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.userId, token.userId),
            eq(verificationTokens.purpose, token.purpose),
          ),
        );
      await tx.insert(verificationTokens).values(token);
    });
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const [consumed] = await this.db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.tokenHash, tokenHash),
          eq(verificationTokens.purpose, purpose),
          gt(verificationTokens.expiresAt, now),
        ),
      )
      .returning({ userId: verificationTokens.userId });
    return consumed?.userId ?? null;
  }

  async deleteExpired(now: Date): Promise<number> {
    const deleted = await this.db
      .delete(verificationTokens)
      .where(lte(verificationTokens.expiresAt, now))
      .returning({ id: verificationTokens.id });
    return deleted.length;
  }
}
