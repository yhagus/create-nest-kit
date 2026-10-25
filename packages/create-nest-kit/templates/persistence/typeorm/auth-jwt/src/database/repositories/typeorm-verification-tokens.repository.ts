import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  type NewVerificationToken,
  type VerificationPurpose,
  VerificationTokensRepository,
} from '../../auth/verification-tokens.repository.js';
import { VerificationTokenEntity } from '../entities/verification-token.entity.js';
import { returnedEntities } from '../query-helpers.js';

@Injectable()
export class TypeOrmVerificationTokensRepository implements VerificationTokensRepository {
  constructor(
    @InjectRepository(VerificationTokenEntity)
    private readonly tokens: Repository<VerificationTokenEntity>,
  ) {}

  async replace(token: NewVerificationToken): Promise<void> {
    await this.tokens.manager.transaction(async (manager) => {
      await manager.delete(VerificationTokenEntity, {
        userId: token.userId,
        purpose: token.purpose,
      });
      await manager.insert(VerificationTokenEntity, { id: uuidv7(), ...token });
    });
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const result = await this.tokens
      .createQueryBuilder()
      .delete()
      .where({ tokenHash, purpose, expiresAt: MoreThan(now) })
      .returning('*')
      .execute();
    const [consumed] = returnedEntities(this.tokens, result);
    return consumed?.userId ?? null;
  }

  async deleteExpired(now: Date): Promise<number> {
    const { affected } = await this.tokens.delete({ expiresAt: LessThanOrEqual(now) });
    return affected ?? 0;
  }
}
