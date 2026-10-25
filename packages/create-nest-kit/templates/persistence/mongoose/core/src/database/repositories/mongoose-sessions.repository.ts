import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Connection, Model, QueryFilter } from 'mongoose';
import type { Session } from '../../modules/sessions/session.js';
import { type NewSession, SessionsRepository } from '../../modules/sessions/sessions.repository.js';
import { CascadeDelete } from '../dependent-documents.js';
import { SessionRecord } from '../schemas/session.schema.js';

@Injectable()
export class MongooseSessionsRepository implements SessionsRepository {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SessionRecord.name) private readonly sessions: Model<SessionRecord>,
    private readonly cascade: CascadeDelete,
  ) {}

  async create(newSession: NewSession): Promise<Session> {
    const created = await this.sessions.create({
      ...newSession,
      lastUsedAt: newSession.createdAt,
      revokedAt: null,
    });
    return toSession(created.toObject());
  }

  async findById(id: string): Promise<Session | null> {
    const record = await this.sessions.findById(id).lean();
    return record && toSession(record);
  }

  async listActive(userId: string, now: Date): Promise<Session[]> {
    const records = await this.sessions
      .find({ userId, ...isActiveAt(now) })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return records.map(toSession);
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    const record = await this.sessions
      .findOneAndUpdate(
        { _id: id, ...isActiveAt(now) },
        // A pipeline, so the new expiry can be capped at the document's own absoluteExpiresAt.
        [{ $set: { lastUsedAt: now, expiresAt: { $min: [expiresAt, '$absoluteExpiresAt'] } } }],
        { returnDocument: 'after', updatePipeline: true },
      )
      .lean();
    return record && toSession(record);
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const unrevoked: QueryFilter<SessionRecord> = { _id: id, revokedAt: null };
    if (options.userId !== undefined) unrevoked.userId = options.userId;

    const { modifiedCount } = await this.sessions.updateOne(unrevoked, {
      $set: { revokedAt: now },
    });
    return modifiedCount === 1;
  }

  /**
   * MongoDB can't return the documents an `updateMany` changed, so this reads the ids and
   * revokes exactly those in one transaction. A concurrent revocation of one of them makes the
   * transaction conflict and retry, so the ids returned are the ones this call revoked.
   */
  revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const unrevoked: QueryFilter<SessionRecord> = { userId, revokedAt: null };
    if (options.exceptId !== undefined) unrevoked._id = { $ne: options.exceptId };

    return this.connection.transaction(async (session) => {
      const ids = await this.idsMatching(unrevoked, session);
      if (ids.length === 0) return [];
      await this.sessions.updateMany(
        { _id: { $in: ids } },
        { $set: { revokedAt: now } },
        { session },
      );
      return ids;
    });
  }

  /** Deletes them with whatever belongs to them, such as their refresh tokens, in one transaction. */
  deleteExpired(now: Date): Promise<number> {
    return this.connection.transaction(async (session) => {
      const ids = await this.idsMatching({ expiresAt: { $lte: now } }, session);
      if (ids.length === 0) return 0;
      const { deletedCount } = await this.sessions.deleteMany({ _id: { $in: ids } }, { session });
      await this.cascade.deleteForSessions(ids, session);
      return deletedCount;
    });
  }

  private async idsMatching(
    filter: QueryFilter<SessionRecord>,
    session: ClientSession,
  ): Promise<string[]> {
    const records = await this.sessions.find(filter, { _id: 1 }).session(session).lean();
    return records.map((record) => record._id);
  }
}

/** Neither revoked nor expired at `now`. `revokedAt: null` also matches a missing field. */
function isActiveAt(now: Date): QueryFilter<SessionRecord> {
  return { revokedAt: null, expiresAt: { $gt: now } };
}

function toSession(record: SessionRecord): Session {
  return {
    id: record._id,
    userId: record.userId,
    userAgent: record.userAgent ?? null,
    ip: record.ip ?? null,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    revokedAt: record.revokedAt ?? null,
  };
}
