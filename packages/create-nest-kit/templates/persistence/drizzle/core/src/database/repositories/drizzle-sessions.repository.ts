import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, ne, sql } from 'drizzle-orm';
import type { Session } from '../../modules/sessions/session.js';
import { type NewSession, SessionsRepository } from '../../modules/sessions/sessions.repository.js';
import { type Database, InjectDatabase } from '../database.js';
import { firstRow } from '../query-helpers.js';
import { sessions } from '../schema/sessions.js';

@Injectable()
export class DrizzleSessionsRepository implements SessionsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async create(session: NewSession): Promise<Session> {
    const rows = await this.db
      .insert(sessions)
      .values({ ...session, lastUsedAt: session.createdAt })
      .returning();
    return firstRow(rows);
  }

  async findById(id: string): Promise<Session | null> {
    const [session] = await this.db.select().from(sessions).where(eq(sessions.id, id));
    return session ?? null;
  }

  listActive(userId: string, now: Date): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isActiveAt(now)))
      .orderBy(desc(sessions.createdAt), desc(sessions.id));
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    const [session] = await this.db
      .update(sessions)
      .set({
        lastUsedAt: now,
        expiresAt: sql`least(${expiresAt.toISOString()}::timestamptz, ${sessions.absoluteExpiresAt})`,
      })
      .where(and(eq(sessions.id, id), isActiveAt(now)))
      .returning();
    return session ?? null;
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.id, id),
          isNull(sessions.revokedAt),
          options.userId === undefined ? undefined : eq(sessions.userId, options.userId),
        ),
      )
      .returning({ id: sessions.id });
    return revoked.length > 0;
  }

  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          options.exceptId === undefined ? undefined : ne(sessions.id, options.exceptId),
        ),
      )
      .returning({ id: sessions.id });
    return revoked.map((session) => session.id);
  }

  async deleteExpired(now: Date): Promise<number> {
    const deleted = await this.db
      .delete(sessions)
      .where(lte(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    return deleted.length;
  }
}

function isActiveAt(now: Date) {
  return and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now));
}
