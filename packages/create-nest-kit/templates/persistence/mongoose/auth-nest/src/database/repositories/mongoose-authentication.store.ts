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
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RefreshTokenFamilies } from '../../auth/refresh-token-families.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { AuthEmailTokenRecord } from '../schemas/auth-email-token.schema.js';
import { AuthRefreshTokenRecord } from '../schemas/auth-refresh-token.schema.js';
import { AuthSessionRecord } from '../schemas/auth-session.schema.js';

/** Anyone can ask for a link, so pending email tokens are capped; past this, those expiring first go. */
const MAX_PENDING_EMAIL_TOKENS = 100_000;

/**
 * `@nestjs/authentication`'s stores on MongoDB: refresh tokens, email tokens and (cookie)
 * sessions. Registers itself with `AuthenticationStorage`. Every rule that makes something work
 * once is a single conditional write, so it holds across instances. Optional fields come back
 * `undefined`, never `null`, and times are the caller's. `AuthTokenDocuments` deletes the
 * documents with the device sessions and users they belong to.
 */
@Injectable()
@ExpiredDataPurger()
export class MongooseAuthenticationStore
  implements
    RefreshTokenStore,
    EmailTokenStore,
    SessionStore,
    RefreshTokenFamilies,
    ExpiredDataPurger
{
  constructor(
    @InjectModel(AuthRefreshTokenRecord.name)
    private readonly refreshTokens: Model<AuthRefreshTokenRecord>,
    @InjectModel(AuthEmailTokenRecord.name)
    private readonly emailTokens: Model<AuthEmailTokenRecord>,
    @InjectModel(AuthSessionRecord.name)
    private readonly sessions: Model<AuthSessionRecord>,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this, emailTokens: this, sessions: this });
  }

  // ------------------------------------------------------------------ refresh tokens

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const document = await this.refreshTokens.findById(id).lean();
    return document === null ? undefined : toRefreshTokenRecord(document);
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const sessionId = record.claims?.['sid'];
    await this.refreshTokens.create({
      _id: record.id,
      familyId: record.familyId,
      userId: record.userId,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      familyExpiresAt: record.familyExpiresAt,
      usedAt: record.usedAt ?? null,
      claims: record.claims ?? null,
    });
    // Keeps the collection bounded: families past their absolute expiry can't be refreshed any more.
    await this.refreshTokens.deleteMany({ familyExpiresAt: { $lte: record.createdAt } });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const { modifiedCount } = await this.refreshTokens.updateOne(
      { _id: id, usedAt: null },
      { $set: { usedAt: at } },
    );
    return modifiedCount === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.refreshTokens.updateMany({ familyId }, { $set: { revoked: true } });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return (await this.refreshTokens.exists({ familyId, revoked: true })) !== null;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokens.updateMany({ userId }, { $set: { revoked: true } });
  }

  async revokeForSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.refreshTokens.updateMany(
      { sessionId: { $in: sessionIds } },
      { $set: { revoked: true } },
    );
  }

  // ------------------------------------------------------------------ email tokens

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.emailTokens.create({
      _id: record.id,
      purpose: record.purpose,
      userId: record.userId,
      email: record.email,
      fingerprint: record.fingerprint ?? null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    });
    await this.emailTokens.deleteMany({ expiresAt: { $lte: record.createdAt } });
    await this.deleteEmailTokensOverCap();
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const document = await this.emailTokens.findOneAndDelete({ _id: id, purpose }).lean();
    return document === null ? undefined : toEmailTokenRecord(document);
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.emailTokens.deleteMany({ userId, purpose });
  }

  /** Every save checks the cap, so this finds at most the few documents saved since the last check. */
  private async deleteEmailTokensOverCap(): Promise<void> {
    const overCap = await this.emailTokens
      .find({}, { _id: 1 })
      .sort({ expiresAt: -1 })
      .skip(MAX_PENDING_EMAIL_TOKENS)
      .lean();
    if (overCap.length === 0) return;
    await this.emailTokens.deleteMany({ _id: { $in: overCap.map((token) => token._id) } });
  }

  // ------------------------------------------------------------------ sessions

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const document = await this.sessions.findById(id).lean();
    return document === null ? undefined : toSessionRecord(document);
  }

  /** `extra` is never stored: it only lives for the request that created the session. */
  async createSession(record: SessionRecord): Promise<void> {
    await this.sessions.create({
      _id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      mfa: record.mfa ?? null,
      metadata: record.metadata ?? null,
    });
    await this.sessions.deleteMany({ expiresAt: { $lte: record.createdAt } });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.sessions.updateOne(
      { _id: id, lastActiveAt: { $lt: lastActiveAt } },
      { $set: { lastActiveAt } },
    );
  }

  async deleteSession(id: string): Promise<boolean> {
    const { deletedCount } = await this.sessions.deleteOne({ _id: id });
    return deletedCount === 1;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const documents = await this.sessions.find({ userId }).lean();
    return documents.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessions.deleteMany({ userId });
  }

  // ------------------------------------------------------------------ daily purge

  async purgeExpired(now: Date): Promise<number> {
    // Whole families only: a family's revocation lives on its tokens, so deleting some of them
    // could leave a later, unrevoked token looking valid.
    const refreshTokens = await this.refreshTokens.deleteMany({ familyExpiresAt: { $lte: now } });
    const emailTokens = await this.emailTokens.deleteMany({ expiresAt: { $lte: now } });
    const sessions = await this.sessions.deleteMany({ expiresAt: { $lte: now } });
    return refreshTokens.deletedCount + emailTokens.deletedCount + sessions.deletedCount;
  }
}

function toRefreshTokenRecord(document: AuthRefreshTokenRecord): RefreshTokenRecord {
  return {
    id: document._id,
    familyId: document.familyId,
    userId: document.userId,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    familyExpiresAt: document.familyExpiresAt,
    ...(document.usedAt !== null && { usedAt: document.usedAt }),
    ...(document.claims !== null && { claims: document.claims }),
  };
}

function toEmailTokenRecord(document: AuthEmailTokenRecord): EmailTokenRecord {
  return {
    id: document._id,
    purpose: document.purpose,
    userId: document.userId,
    email: document.email,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    ...(document.fingerprint !== null && { fingerprint: document.fingerprint }),
  };
}

function toSessionRecord(document: AuthSessionRecord): SessionRecord {
  return {
    id: document._id,
    userId: document.userId,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
    lastActiveAt: document.lastActiveAt,
    ...(document.mfa !== null && { mfa: document.mfa }),
    ...(document.metadata !== null && { metadata: document.metadata }),
  };
}
