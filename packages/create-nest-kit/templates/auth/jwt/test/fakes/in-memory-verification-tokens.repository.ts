import type {
  NewVerificationToken,
  VerificationPurpose,
  VerificationTokensRepository,
} from '../../src/auth/verification-tokens.repository.js';
import type { InMemoryStore } from './in-memory-store.js';

export class InMemoryVerificationTokensRepository implements VerificationTokensRepository {
  private tokens: NewVerificationToken[] = [];

  /** `store` holds the users, whose deletion takes their tokens along, as a foreign key would. */
  constructor(private readonly store: InMemoryStore) {}

  async replace(token: NewVerificationToken): Promise<void> {
    this.dropTokensOfDeletedUsers();
    this.tokens = this.tokens.filter(
      (existing) => existing.userId !== token.userId || existing.purpose !== token.purpose,
    );
    this.tokens.push({ ...token });
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    this.dropTokensOfDeletedUsers();
    const token = this.tokens.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        candidate.purpose === purpose &&
        candidate.expiresAt > now,
    );
    if (!token) return null;
    this.tokens = this.tokens.filter((candidate) => candidate !== token);
    return token.userId;
  }

  async deleteExpired(now: Date): Promise<number> {
    this.dropTokensOfDeletedUsers();
    const before = this.tokens.length;
    this.tokens = this.tokens.filter((token) => token.expiresAt > now);
    return before - this.tokens.length;
  }

  private dropTokensOfDeletedUsers(): void {
    this.tokens = this.tokens.filter((token) => this.store.users.has(token.userId));
  }
}
