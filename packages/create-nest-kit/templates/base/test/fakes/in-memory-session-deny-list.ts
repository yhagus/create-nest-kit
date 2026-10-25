import type { SessionDenyList } from '../../src/modules/sessions/session-deny-list.js';

/** Stands in for the Redis deny-list in unit tests. Entries never expire. */
export class InMemorySessionDenyList implements Pick<SessionDenyList, keyof SessionDenyList> {
  private readonly sessionIds = new Set<string>();

  async add(sessionIds: readonly string[]): Promise<void> {
    for (const id of sessionIds) this.sessionIds.add(id);
  }

  async includes(sessionId: string): Promise<boolean> {
    return this.sessionIds.has(sessionId);
  }
}
