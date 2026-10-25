import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { and, desc, eq, inArray, isNull, lt, lte } from 'drizzle-orm';
import { RefreshTokenFamilies } from '../../auth/refresh-token-families.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { type Database, InjectDatabase } from '../database.js';
import { authEmailTokens } from '../schema/auth-email-tokens.js';
import { authRefreshTokens } from '../schema/auth-refresh-tokens.js';
import { authSessions } from '../schema/auth-sessions.js';

/** Anyone can ask for a link, so pending email tokens are capped; past this, those expiring first go. */
const MAX_PENDING_EMAIL_TOKENS = 100_000;

type RefreshTokenRow = typeof authRefreshTokens.$inferSelect;
type EmailTokenRow = typeof authEmailTokens.$inferSelect;
type SessionRow = typeof authSessions.$inferSelect;

/**
 * `@nestjs/authentication`'s stores on Postgres: refresh tokens, email tokens and (cookie)
 * sessions. Registers itself with `AuthenticationStorage`. Every rule that makes something work
 * once is a single conditional statement, so it holds across instances. Optional fields come
 * back `undefined`, never `null`, and times are the caller's.
 */
@Injectable()
@ExpiredDataPurger()
export class DrizzleAuthenticationStore
  implements
    RefreshTokenStore,
    EmailTokenStore,
    SessionStore,
    RefreshTokenFamilies,
    ExpiredDataPurger
{
  constructor(
    @InjectDatabase() private readonly db: Database,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this, emailTokens: this, sessions: this });
  }

  // ------------------------------------------------------------------ refresh tokens

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.id, id));
    return row && toRefreshTokenRecord(row);
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const sessionId = record.claims?.['sid'];
    await this.db.insert(authRefreshTokens).values({
      ...record,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
    });
    // Keeps the table bounded: families past their absolute expiry can't be refreshed any more.
    await this.db
      .delete(authRefreshTokens)
      .where(lte(authRefreshTokens.familyExpiresAt, record.createdAt));
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const marked = await this.db
      .update(authRefreshTokens)
      .set({ usedAt: at })
      .where(and(eq(authRefreshTokens.id, id), isNull(authRefreshTokens.usedAt)))
      .returning({ id: authRefreshTokens.id });
    return marked.length > 0;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({ revoked: true })
      .where(eq(authRefreshTokens.familyId, familyId));
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    const [revoked] = await this.db
      .select({ id: authRefreshTokens.id })
      .from(authRefreshTokens)
      .where(and(eq(authRefreshTokens.familyId, familyId), eq(authRefreshTokens.revoked, true)))
      .limit(1);
    return revoked !== undefined;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.db
      .update(authRefreshTokens)
      .set({ revoked: true })
      .where(eq(authRefreshTokens.userId, userId));
  }

  async revokeForSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.db
      .update(authRefreshTokens)
      .set({ revoked: true })
      .where(inArray(authRefreshTokens.sessionId, [...sessionIds]));
  }

  // ------------------------------------------------------------------ email tokens

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.db.insert(authEmailTokens).values(record);
    await this.db.delete(authEmailTokens).where(lte(authEmailTokens.expiresAt, record.createdAt));
    const overCap = this.db
      .select({ id: authEmailTokens.id })
      .from(authEmailTokens)
      .orderBy(desc(authEmailTokens.expiresAt))
      .offset(MAX_PENDING_EMAIL_TOKENS);
    await this.db.delete(authEmailTokens).where(inArray(authEmailTokens.id, overCap));
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const [row] = await this.db
      .delete(authEmailTokens)
      .where(and(eq(authEmailTokens.id, id), eq(authEmailTokens.purpose, purpose)))
      .returning();
    return row && toEmailTokenRecord(row);
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.db
      .delete(authEmailTokens)
      .where(and(eq(authEmailTokens.userId, userId), eq(authEmailTokens.purpose, purpose)));
  }

  // ------------------------------------------------------------------ sessions

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [row] = await this.db.select().from(authSessions).where(eq(authSessions.id, id));
    return row && toSessionRecord(row);
  }

  async createSession(record: SessionRecord): Promise<void> {
    const { extra: _neverStored, ...stored } = record;
    await this.db.insert(authSessions).values(stored);
    await this.db.delete(authSessions).where(lte(authSessions.expiresAt, record.createdAt));
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ lastActiveAt })
      .where(and(eq(authSessions.id, id), lt(authSessions.lastActiveAt, lastActiveAt)));
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(authSessions)
      .where(eq(authSessions.id, id))
      .returning({ id: authSessions.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db.select().from(authSessions).where(eq(authSessions.userId, userId));
    return rows.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(authSessions).where(eq(authSessions.userId, userId));
  }

  // ------------------------------------------------------------------ daily purge

  async purgeExpired(now: Date): Promise<number> {
    // Whole families only: a family's revocation lives on its tokens, so deleting some of them
    // could leave a later, unrevoked token looking valid.
    const refreshTokens = await this.db
      .delete(authRefreshTokens)
      .where(lte(authRefreshTokens.familyExpiresAt, now))
      .returning({ id: authRefreshTokens.id });
    const emailTokens = await this.db
      .delete(authEmailTokens)
      .where(lte(authEmailTokens.expiresAt, now))
      .returning({ id: authEmailTokens.id });
    const sessions = await this.db
      .delete(authSessions)
      .where(lte(authSessions.expiresAt, now))
      .returning({ id: authSessions.id });
    return refreshTokens.length + emailTokens.length + sessions.length;
  }
}

function toRefreshTokenRecord(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    familyId: row.familyId,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    familyExpiresAt: row.familyExpiresAt,
    ...(row.usedAt !== null && { usedAt: row.usedAt }),
    ...(row.claims !== null && { claims: row.claims }),
  };
}

function toEmailTokenRecord(row: EmailTokenRow): EmailTokenRecord {
  return {
    id: row.id,
    purpose: row.purpose,
    userId: row.userId,
    email: row.email,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...(row.fingerprint !== null && { fingerprint: row.fingerprint }),
  };
}

function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastActiveAt: row.lastActiveAt,
    ...(row.mfa !== null && { mfa: row.mfa }),
    ...(row.metadata !== null && { metadata: row.metadata }),
  };
}
