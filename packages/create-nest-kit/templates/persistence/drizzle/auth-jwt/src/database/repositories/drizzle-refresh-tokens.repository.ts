import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { RefreshTokensRepository } from '../../auth/refresh-tokens.repository.js';
import { type Database, InjectDatabase } from '../database.js';
import { sessionRefreshTokens } from '../schema/session-refresh-tokens.js';

@Injectable()
export class DrizzleRefreshTokensRepository implements RefreshTokensRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    await this.db.insert(sessionRefreshTokens).values({ sessionId, tokenHash });
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    const rotated = await this.db
      .update(sessionRefreshTokens)
      .set({ tokenHash: nextHash })
      .where(
        and(
          eq(sessionRefreshTokens.sessionId, sessionId),
          eq(sessionRefreshTokens.tokenHash, currentHash),
        ),
      )
      .returning({ sessionId: sessionRefreshTokens.sessionId });
    return rotated.length > 0;
  }
}
