import { EntityManager } from '@mikro-orm/postgresql';
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
import { RefreshTokenFamilies } from '../../auth/refresh-token-families.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { AuthEmailTokenEntity } from '../entities/auth-email-token.entity.js';
import { AuthRefreshTokenEntity } from '../entities/auth-refresh-token.entity.js';
import { AuthSessionEntity } from '../entities/auth-session.entity.js';

/** Anyone can ask for a link, so pending email tokens are capped; past this, those expiring first go. */
const MAX_PENDING_EMAIL_TOKENS = 100_000;

/**
 * `@nestjs/authentication`'s stores on Postgres: refresh tokens, email tokens and (cookie)
 * sessions. Registers itself with `AuthenticationStorage`. Every rule that makes something work
 * once is a single conditional statement, so it holds across instances. Optional fields come
 * back `undefined`, never `null`, and times are the caller's.
 * Every method runs on its own fork of the EntityManager, so it works outside an HTTP request.
 */
@Injectable()
@ExpiredDataPurger()
export class MikroOrmAuthenticationStore
  implements
    RefreshTokenStore,
    EmailTokenStore,
    SessionStore,
    RefreshTokenFamilies,
    ExpiredDataPurger
{
  constructor(
    private readonly em: EntityManager,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this, emailTokens: this, sessions: this });
  }

  // ------------------------------------------------------------------ refresh tokens

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.em.fork().findOne(AuthRefreshTokenEntity, { id });
    return row ? toRefreshTokenRecord(row) : undefined;
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const em = this.em.fork();
    const sessionId = record.claims?.['sid'];
    await em.insert(AuthRefreshTokenEntity, {
      ...record,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      usedAt: record.usedAt ?? null,
      claims: record.claims ?? null,
      revoked: false,
    });
    // Keeps the table bounded: families past their absolute expiry can't be refreshed any more.
    await em.nativeDelete(AuthRefreshTokenEntity, {
      familyExpiresAt: { $lte: record.createdAt },
    });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const marked = await this.em
      .fork()
      .nativeUpdate(AuthRefreshTokenEntity, { id, usedAt: null }, { usedAt: at });
    return marked === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.em.fork().nativeUpdate(AuthRefreshTokenEntity, { familyId }, { revoked: true });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    const revoked = await this.em
      .fork()
      .findOne(AuthRefreshTokenEntity, { familyId, revoked: true }, { fields: ['id'] });
    return revoked !== null;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.em.fork().nativeUpdate(AuthRefreshTokenEntity, { userId }, { revoked: true });
  }

  async revokeForSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.em
      .fork()
      .nativeUpdate(
        AuthRefreshTokenEntity,
        { sessionId: { $in: [...sessionIds] } },
        { revoked: true },
      );
  }

  // ------------------------------------------------------------------ email tokens

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    const em = this.em.fork();
    await em.insert(AuthEmailTokenEntity, { ...record, fingerprint: record.fingerprint ?? null });
    await em.nativeDelete(AuthEmailTokenEntity, { expiresAt: { $lte: record.createdAt } });
    await em.execute(
      `delete from auth_email_tokens
       where id in (select id from auth_email_tokens order by expires_at desc offset ?)`,
      [MAX_PENDING_EMAIL_TOKENS],
    );
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const em = this.em.fork();
    // MikroORM's query builder drops `returning` from a delete, so this one statement is plain SQL.
    const [row] = await em.execute(
      'delete from auth_email_tokens where id = ? and purpose = ? returning *',
      [id, purpose],
    );
    return row ? toEmailTokenRecord(em.map(AuthEmailTokenEntity, row)) : undefined;
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.em.fork().nativeDelete(AuthEmailTokenEntity, { userId, purpose });
  }

  // ------------------------------------------------------------------ sessions

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.em.fork().findOne(AuthSessionEntity, { id });
    return row ? toSessionRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    const em = this.em.fork();
    const { extra: _neverStored, ...stored } = record;
    await em.insert(AuthSessionEntity, {
      ...stored,
      mfa: stored.mfa ?? null,
      metadata: stored.metadata ?? null,
    });
    await em.nativeDelete(AuthSessionEntity, { expiresAt: { $lte: record.createdAt } });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.em
      .fork()
      .nativeUpdate(
        AuthSessionEntity,
        { id, lastActiveAt: { $lt: lastActiveAt } },
        { lastActiveAt },
      );
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await this.em.fork().nativeDelete(AuthSessionEntity, { id });
    return deleted === 1;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.em.fork().find(AuthSessionEntity, { userId });
    return rows.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.em.fork().nativeDelete(AuthSessionEntity, { userId });
  }

  // ------------------------------------------------------------------ daily purge

  async purgeExpired(now: Date): Promise<number> {
    const em = this.em.fork();
    // Whole families only: a family's revocation lives on its tokens, so deleting some of them
    // could leave a later, unrevoked token looking valid.
    const refreshTokens = await em.nativeDelete(AuthRefreshTokenEntity, {
      familyExpiresAt: { $lte: now },
    });
    const emailTokens = await em.nativeDelete(AuthEmailTokenEntity, { expiresAt: { $lte: now } });
    const sessions = await em.nativeDelete(AuthSessionEntity, { expiresAt: { $lte: now } });
    return refreshTokens + emailTokens + sessions;
  }
}

function toRefreshTokenRecord(row: AuthRefreshTokenEntity): RefreshTokenRecord {
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

function toEmailTokenRecord(row: AuthEmailTokenEntity): EmailTokenRecord {
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

function toSessionRecord(row: AuthSessionEntity): SessionRecord {
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
