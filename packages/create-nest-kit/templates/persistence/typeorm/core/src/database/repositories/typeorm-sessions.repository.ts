import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, IsNull, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import type { Session } from '../../modules/sessions/session.js';
import { type NewSession, SessionsRepository } from '../../modules/sessions/sessions.repository.js';
import { SessionEntity } from '../entities/session.entity.js';
import { returnedEntities } from '../query-helpers.js';

@Injectable()
export class TypeOrmSessionsRepository implements SessionsRepository {
  constructor(
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
  ) {}

  async create(newSession: NewSession): Promise<Session> {
    const session = this.sessions.create({
      ...newSession,
      id: uuidv7(),
      lastUsedAt: newSession.createdAt,
      revokedAt: null,
    });
    await this.sessions.insert(session);
    return session;
  }

  findById(id: string): Promise<Session | null> {
    return this.sessions.findOneBy({ id });
  }

  listActive(userId: string, now: Date): Promise<Session[]> {
    return this.sessions.find({
      where: { userId, ...isActiveAt(now) },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    const result = await this.sessions
      .createQueryBuilder()
      .update()
      .set({
        lastUsedAt: now,
        expiresAt: () => 'least(:expiresAt, absolute_expires_at)',
      })
      .setParameters({ expiresAt })
      .where({ id, ...isActiveAt(now) })
      .returning('*')
      .execute();
    const [session] = returnedEntities(this.sessions, result);
    return session ?? null;
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const unrevoked: FindOptionsWhere<SessionEntity> = { id, revokedAt: IsNull() };
    if (options.userId !== undefined) unrevoked.userId = options.userId;

    const { affected } = await this.sessions
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where(unrevoked)
      .execute();
    return affected === 1;
  }

  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const unrevoked: FindOptionsWhere<SessionEntity> = { userId, revokedAt: IsNull() };
    if (options.exceptId !== undefined) unrevoked.id = Not(options.exceptId);

    const result = await this.sessions
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where(unrevoked)
      .returning('*')
      .execute();
    return returnedEntities(this.sessions, result).map((session) => session.id);
  }

  async deleteExpired(now: Date): Promise<number> {
    const { affected } = await this.sessions.delete({ expiresAt: LessThanOrEqual(now) });
    return affected ?? 0;
  }
}

function isActiveAt(now: Date): FindOptionsWhere<SessionEntity> {
  return { revokedAt: IsNull(), expiresAt: MoreThan(now) };
}
