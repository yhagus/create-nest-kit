import { randomUUID } from 'node:crypto';
import { isActive, type Session } from '../../src/modules/sessions/session.js';
import type {
  NewSession,
  SessionsRepository,
} from '../../src/modules/sessions/sessions.repository.js';
import type { InMemoryStore } from './in-memory-store.js';

export class InMemorySessionsRepository implements SessionsRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(newSession: NewSession): Promise<Session> {
    const session: Session = {
      ...structuredClone(newSession),
      id: randomUUID(),
      lastUsedAt: newSession.createdAt,
      revokedAt: null,
    };
    this.store.sessions.set(session.id, session);
    return structuredClone(session);
  }

  async findById(id: string): Promise<Session | null> {
    const session = this.store.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async listActive(userId: string, now: Date): Promise<Session[]> {
    return [...this.store.sessions.values()]
      .filter((session) => session.userId === userId && isActive(session, now))
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((session) => structuredClone(session));
  }

  async touch(id: string, now: Date, expiresAt: Date): Promise<Session | null> {
    const session = this.store.sessions.get(id);
    if (!session || !isActive(session, now)) return null;
    session.lastUsedAt = now;
    session.expiresAt =
      expiresAt < session.absoluteExpiresAt ? expiresAt : session.absoluteExpiresAt;
    return structuredClone(session);
  }

  async revoke(id: string, now: Date, options: { userId?: string } = {}): Promise<boolean> {
    const session = this.store.sessions.get(id);
    if (!session || session.revokedAt !== null) return false;
    if (options.userId !== undefined && session.userId !== options.userId) return false;
    session.revokedAt = now;
    return true;
  }

  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { exceptId?: string } = {},
  ): Promise<string[]> {
    const revokedIds: string[] = [];
    for (const session of this.store.sessions.values()) {
      if (
        session.userId !== userId ||
        session.revokedAt !== null ||
        session.id === options.exceptId
      ) {
        continue;
      }
      session.revokedAt = now;
      revokedIds.push(session.id);
    }
    return revokedIds;
  }

  async deleteExpired(now: Date): Promise<number> {
    let deleted = 0;
    for (const session of this.store.sessions.values()) {
      if (session.expiresAt <= now) {
        this.store.sessions.delete(session.id);
        deleted += 1;
      }
    }
    return deleted;
  }
}
