import { InMemoryRolesRepository } from './in-memory-roles.repository.js';
import { InMemorySessionsRepository } from './in-memory-sessions.repository.js';
import { InMemoryStore } from './in-memory-store.js';
import { InMemoryUsersRepository } from './in-memory-users.repository.js';

export interface InMemoryRepositories {
  /** The shared tables, for fakes of other layers whose rows reference users or sessions. */
  store: InMemoryStore;
  users: InMemoryUsersRepository;
  roles: InMemoryRolesRepository;
  sessions: InMemorySessionsRepository;
}

/** Fresh, empty repositories that share one store. */
export function createInMemoryRepositories(): InMemoryRepositories {
  const store = new InMemoryStore();
  return {
    store,
    users: new InMemoryUsersRepository(store),
    roles: new InMemoryRolesRepository(store),
    sessions: new InMemorySessionsRepository(store),
  };
}
