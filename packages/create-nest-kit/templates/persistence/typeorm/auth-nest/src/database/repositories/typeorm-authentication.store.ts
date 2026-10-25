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
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { RefreshTokenFamilies } from '../../auth/refresh-token-families.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { AuthEmailTokenEntity } from '../entities/auth-email-token.entity.js';
import { AuthRefreshTokenEntity } from '../entities/auth-refresh-token.entity.js';
import { AuthSessionEntity } from '../entities/auth-session.entity.js';
import { returnedEntities } from '../query-helpers.js';

/** Anyone can ask for a link, so pending email tokens are capped; past this, those expiring first go. */
const MAX_PENDING_EMAIL_TOKENS = 100_000;

/**
 * `@nestjs/authentication`'s stores on Postgres: refresh tokens, email tokens and (cookie)
 * sessions. Registers itself with `AuthenticationStorage`. Every rule that makes something work
 * once is a single conditional statement, so it holds across instances. Optional fields come
 * back `undefined`, never `null`, and times are the caller's.
 */
@Injectable()
@ExpiredDataPurger()
export class TypeOrmAuthenticationStore
  implements
    RefreshTokenStore,
    EmailTokenStore,
    SessionStore,
    RefreshTokenFamilies,
    ExpiredDataPurger
{
  constructor(
    @InjectRepository(AuthRefreshTokenEntity)
    private readonly refreshTokens: Repository<AuthRefreshTokenEntity>,
    @InjectRepository(AuthEmailTokenEntity)
    private readonly emailTokens: Repository<AuthEmailTokenEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this, emailTokens: this, sessions: this });
  }

  // ------------------------------------------------------------------ refresh tokens

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.refreshTokens.findOneBy({ id });
    return row === null ? undefined : toRefreshTokenRecord(row);
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const sessionId = record.claims?.['sid'];
    await this.refreshTokens
      .createQueryBuilder()
      .insert()
      .values({
        id: record.id,
        familyId: record.familyId,
        userId: record.userId,
        sessionId: typeof sessionId === 'string' ? sessionId : null,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        familyExpiresAt: record.familyExpiresAt,
        usedAt: record.usedAt ?? null,
        // A parameter, because TypeORM's insert types reject `Record<string, unknown>`; pg sends it as JSON.
        claims: () => ':claims',
      })
      .setParameter('claims', record.claims ?? null)
      .execute();
    // Keeps the table bounded: families past their absolute expiry can't be refreshed any more.
    await this.refreshTokens.delete({ familyExpiresAt: LessThanOrEqual(record.createdAt) });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const { affected } = await this.refreshTokens.update({ id, usedAt: IsNull() }, { usedAt: at });
    return affected === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.refreshTokens.update({ familyId }, { revoked: true });
  }

  isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return this.refreshTokens.existsBy({ familyId, revoked: true });
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId }, { revoked: true });
  }

  async revokeForSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.refreshTokens.update({ sessionId: In([...sessionIds]) }, { revoked: true });
  }

  // ------------------------------------------------------------------ email tokens

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.emailTokens.insert({
      id: record.id,
      purpose: record.purpose,
      userId: record.userId,
      email: record.email,
      fingerprint: record.fingerprint ?? null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    });
    await this.emailTokens.delete({ expiresAt: LessThanOrEqual(record.createdAt) });
    await this.deleteEmailTokensOverCap();
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const result = await this.emailTokens
      .createQueryBuilder()
      .delete()
      .where({ id, purpose })
      .returning('*')
      .execute();
    const [row] = returnedEntities(this.emailTokens, result);
    return row && toEmailTokenRecord(row);
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.emailTokens.delete({ userId, purpose });
  }

  /** Every save checks the cap, so this finds at most the few rows saved since the last check. */
  private async deleteEmailTokensOverCap(): Promise<void> {
    const overCap = await this.emailTokens.find({
      select: { id: true },
      order: { expiresAt: 'DESC' },
      skip: MAX_PENDING_EMAIL_TOKENS,
    });
    if (overCap.length === 0) return;
    await this.emailTokens.delete({ id: In(overCap.map((token) => token.id)) });
  }

  // ------------------------------------------------------------------ sessions

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.sessions.findOneBy({ id });
    return row === null ? undefined : toSessionRecord(row);
  }

  /** `extra` is never stored: it only lives for the request that created the session. */
  async createSession(record: SessionRecord): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .insert()
      .values({
        id: record.id,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt,
        mfa: record.mfa ?? null,
        // A parameter for the same reason as `claims` in saveRefreshToken().
        metadata: () => ':metadata',
      })
      .setParameter('metadata', record.metadata ?? null)
      .execute();
    await this.sessions.delete({ expiresAt: LessThanOrEqual(record.createdAt) });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.sessions.update({ id, lastActiveAt: LessThan(lastActiveAt) }, { lastActiveAt });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { affected } = await this.sessions.delete({ id });
    return affected === 1;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.sessions.findBy({ userId });
    return rows.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessions.delete({ userId });
  }

  // ------------------------------------------------------------------ daily purge

  async purgeExpired(now: Date): Promise<number> {
    // Whole families only: a family's revocation lives on its tokens, so deleting some of them
    // could leave a later, unrevoked token looking valid.
    const refreshTokens = await this.refreshTokens.delete({
      familyExpiresAt: LessThanOrEqual(now),
    });
    const emailTokens = await this.emailTokens.delete({ expiresAt: LessThanOrEqual(now) });
    const sessions = await this.sessions.delete({ expiresAt: LessThanOrEqual(now) });
    return (refreshTokens.affected ?? 0) + (emailTokens.affected ?? 0) + (sessions.affected ?? 0);
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
