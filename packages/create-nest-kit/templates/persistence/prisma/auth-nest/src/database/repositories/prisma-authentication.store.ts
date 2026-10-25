import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type MfaState,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { RefreshTokenFamilies } from '../../auth/refresh-token-families.js';
import type {
  AuthEmailToken as EmailTokenRow,
  AuthRefreshToken as RefreshTokenRow,
  AuthSession as SessionRow,
  Prisma,
} from '../../generated/prisma/client.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { PrismaService } from '../prisma.service.js';

/** Anyone can ask for a link, so pending email tokens are capped; past this, those expiring first go. */
const MAX_PENDING_EMAIL_TOKENS = 100_000;

/** The values the text columns `auth_email_tokens.purpose` and `auth_sessions.mfa` hold. */
const EMAIL_TOKEN_PURPOSES = [
  'password-reset',
  'email-verification',
] as const satisfies readonly EmailTokenPurpose[];
const MFA_STATES = ['pending', 'verified'] as const satisfies readonly MfaState[];

/**
 * `@nestjs/authentication`'s stores on Postgres: refresh tokens, email tokens and (cookie)
 * sessions. Registers itself with `AuthenticationStorage`. Every rule that makes something work
 * once is a single conditional write, so it holds across instances. Optional fields come back
 * `undefined`, never `null`, and times are the caller's.
 */
@Injectable()
@ExpiredDataPurger()
export class PrismaAuthenticationStore
  implements
    RefreshTokenStore,
    EmailTokenStore,
    SessionStore,
    RefreshTokenFamilies,
    ExpiredDataPurger
{
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ refreshTokens: this, emailTokens: this, sessions: this });
  }

  // ------------------------------------------------------------------ refresh tokens

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.prisma.authRefreshToken.findUnique({ where: { id } });
    return row ? toRefreshTokenRecord(row) : undefined;
  }

  async saveRefreshToken({ claims, ...record }: RefreshTokenRecord): Promise<void> {
    const sessionId = claims?.['sid'];
    await this.prisma.authRefreshToken.create({
      data: {
        ...record,
        claims: claims === undefined ? undefined : toJsonObject(claims),
        sessionId: typeof sessionId === 'string' ? sessionId : null,
      },
    });
    // Keeps the table bounded: families past their absolute expiry can't be refreshed any more.
    await this.prisma.authRefreshToken.deleteMany({
      where: { familyExpiresAt: { lte: record.createdAt } },
    });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.authRefreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count > 0;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({
      where: { familyId },
      data: { revoked: true },
    });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    const revoked = await this.prisma.authRefreshToken.findFirst({
      where: { familyId, revoked: true },
      select: { id: true },
    });
    return revoked !== null;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }

  async revokeForSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.prisma.authRefreshToken.updateMany({
      where: { sessionId: { in: [...sessionIds] } },
      data: { revoked: true },
    });
  }

  // ------------------------------------------------------------------ email tokens

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.prisma.authEmailToken.create({ data: record });
    await this.prisma.authEmailToken.deleteMany({
      where: { expiresAt: { lte: record.createdAt } },
    });
    const overCap = await this.prisma.authEmailToken.findMany({
      select: { id: true },
      orderBy: { expiresAt: 'desc' },
      skip: MAX_PENDING_EMAIL_TOKENS,
    });
    if (overCap.length === 0) return;
    await this.prisma.authEmailToken.deleteMany({
      where: { id: { in: overCap.map((token) => token.id) } },
    });
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const row = await this.prisma.authEmailToken.findFirst({ where: { id, purpose } });
    if (!row) return undefined;

    // Prisma can't return the rows a delete removed, so find the token first. Only one of
    // several concurrent calls deletes the row, and only that one gets the record.
    const { count } = await this.prisma.authEmailToken.deleteMany({ where: { id } });
    return count > 0 ? toEmailTokenRecord(row) : undefined;
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.prisma.authEmailToken.deleteMany({ where: { userId, purpose } });
  }

  // ------------------------------------------------------------------ sessions

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.authSession.findUnique({ where: { id } });
    return row ? toSessionRecord(row) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    const { extra: _neverStored, metadata, ...stored } = record;
    await this.prisma.authSession.create({
      data: { ...stored, metadata: metadata === undefined ? undefined : toJsonObject(metadata) },
    });
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lte: record.createdAt } } });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id, lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { count } = await this.prisma.authSession.deleteMany({ where: { id } });
    return count > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.prisma.authSession.findMany({ where: { userId } });
    return rows.map(toSessionRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
  }

  // ------------------------------------------------------------------ daily purge

  async purgeExpired(now: Date): Promise<number> {
    // Whole families only: a family's revocation lives on its tokens, so deleting some of them
    // could leave a later, unrevoked token looking valid.
    const refreshTokens = await this.prisma.authRefreshToken.deleteMany({
      where: { familyExpiresAt: { lte: now } },
    });
    const emailTokens = await this.prisma.authEmailToken.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    const sessions = await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return refreshTokens.count + emailTokens.count + sessions.count;
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
    ...(isJsonObject(row.claims) && { claims: row.claims }),
  };
}

function toEmailTokenRecord(row: EmailTokenRow): EmailTokenRecord {
  return {
    id: row.id,
    purpose: oneOf(EMAIL_TOKEN_PURPOSES, row.purpose),
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
    ...(row.mfa !== null && { mfa: oneOf(MFA_STATES, row.mfa) }),
    ...(isJsonObject(row.metadata) && { metadata: row.metadata }),
  };
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Claims and metadata are JSON: the package puts them in tokens and cookies. */
function toJsonObject(record: Record<string, unknown>): Prisma.InputJsonObject {
  if (!isInputJsonObject(record)) throw new Error('Claims and metadata must be JSON values');
  return record;
}

function isInputJsonObject(record: Record<string, unknown>): record is Prisma.InputJsonObject {
  return Object.values(record).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  const isPlainObject = prototype === Object.prototype || prototype === null;
  return isPlainObject && Object.values(value).every(isJsonValue);
}

/** `value` as one of `allowed`; anything else means the row was written outside this store. */
function oneOf<Allowed extends string>(allowed: readonly Allowed[], value: string): Allowed {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new Error(`Unexpected value stored by the auth store: ${value}`);
  return match;
}
