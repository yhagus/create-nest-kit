import type { RefreshTokensRepository } from '../../src/auth/refresh-tokens.repository.js';
import type { InMemoryStore } from './in-memory-store.js';

export class InMemoryRefreshTokensRepository implements RefreshTokensRepository {
  private readonly hashesBySessionId = new Map<string, string>();

  /** `store` holds the sessions, whose deletion takes their tokens along, as a foreign key would. */
  constructor(private readonly store: InMemoryStore) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    this.hashesBySessionId.set(sessionId, tokenHash);
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    this.dropTokensOfDeletedSessions();
    if (this.hashesBySessionId.get(sessionId) !== currentHash) return false;
    this.hashesBySessionId.set(sessionId, nextHash);
    return true;
  }

  private dropTokensOfDeletedSessions(): void {
    for (const sessionId of this.hashesBySessionId.keys()) {
      if (!this.store.sessions.has(sessionId)) this.hashesBySessionId.delete(sessionId);
    }
  }
}
