import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
  type NewVerificationToken,
  type VerificationPurpose,
  VerificationTokensRepository,
} from '../../auth/verification-tokens.repository.js';
import { VerificationTokenEntity } from '../entities/verification-token.entity.js';

/** Every method runs on its own fork of the EntityManager, so it works outside an HTTP request. */
@Injectable()
export class MikroOrmVerificationTokensRepository implements VerificationTokensRepository {
  constructor(private readonly em: EntityManager) {}

  async replace(token: NewVerificationToken): Promise<void> {
    await this.em.fork().transactional(async (em) => {
      await em.nativeDelete(VerificationTokenEntity, {
        userId: token.userId,
        purpose: token.purpose,
      });
      await em.insert(VerificationTokenEntity, { id: uuidv7(), ...token });
    });
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    // MikroORM's query builder drops `returning` from a delete, so this one statement is plain SQL.
    const [consumed] = await this.em.fork().execute<{ user_id: string }[]>(
      `delete from verification_tokens
       where token_hash = ? and purpose = ? and expires_at > ?
       returning user_id`,
      [tokenHash, purpose, now],
    );
    return consumed?.user_id ?? null;
  }

  deleteExpired(now: Date): Promise<number> {
    return this.em.fork().nativeDelete(VerificationTokenEntity, { expiresAt: { $lte: now } });
  }
}
