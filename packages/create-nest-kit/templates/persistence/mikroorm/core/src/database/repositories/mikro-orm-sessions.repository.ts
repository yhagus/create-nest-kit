import { type FilterQuery, sql } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Session } from '../../modules/sessions/session.js';
import { type NewSession, SessionsRepository } from '../../modules/sessions/sessions.repository.js';
import { SessionEntity } from '../entities/session.entity.js';

/**
 * Every change to a stored session is one conditional statement, so concurrent calls can't
 * interleave badly.
 * Every method runs on its own fork of the EntityManager, so it works outside an HTTP request
 * (queue jobs, the seed, tests) and never reads a stale row from a shared identity map.
 */
@Injectable()
export class MikroOrmSessionsRepository implements SessionsRepository {
  constructor(private readonly em: EntityManager) {}

  async create(newSession: NewSession): Promise<Session> {
    const session: Session = {
      ...newSession,
      id: uuidv7(),
      lastUsedAt: newSession.createdAt,
      revokedAt: null,
    };
    await this.em.fork().insert(SessionEntity, session);
    return session;
  }

  findById(id: string): Promise<Session | null> {
    return this.em.fork().findOne(SessionEntity, { id });
  }

  listActive(userId: string, now: Date): Promise<Session[]> {
    return this.em
      .fork()
      .find(
        SessionEntity,
        { userId, ...isActiveAt(now) },
        { orderBy: { createdAt: 'desc', id: 'desc' } },
      );
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    const [session] = await this.em
      .fork()
      .createQueryBuilder(SessionEntity)
      .update({
        lastUsedAt: now,
        expiresAt: sql`least(${expiresAt}, absolute_expires_at)`,
      })
      .where({ id, ...isActiveAt(now) })
      .returning('*')
      .execute<Session[]>('all');
    return session ?? null;
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const unrevoked: FilterQuery<SessionEntity> =
      options.userId === undefined
        ? { id, revokedAt: null }
        : { id, revokedAt: null, userId: options.userId };

    const revoked = await this.em.fork().nativeUpdate(SessionEntity, unrevoked, { revokedAt: now });
    return revoked === 1;
  }

  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const query = this.em
      .fork()
      .createQueryBuilder(SessionEntity)
      .update({ revokedAt: now })
      .where({ userId, revokedAt: null })
      .returning('id');
    if (options.exceptId !== undefined) query.andWhere({ id: { $ne: options.exceptId } });

    const revoked = await query.execute<Pick<Session, 'id'>[]>('all');
    return revoked.map((session) => session.id);
  }

  deleteExpired(now: Date): Promise<number> {
    return this.em.fork().nativeDelete(SessionEntity, { expiresAt: { $lte: now } });
  }
}

/** Neither revoked nor expired at `now`. */
function isActiveAt(now: Date) {
  return { revokedAt: null, expiresAt: { $gt: now } };
}
