import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import {
  type NewVerificationToken,
  type VerificationPurpose,
  VerificationTokensRepository,
} from '../../auth/verification-tokens.repository.js';
import { VerificationTokenRecord } from '../schemas/verification-token.schema.js';

@Injectable()
export class MongooseVerificationTokensRepository implements VerificationTokensRepository {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(VerificationTokenRecord.name)
    private readonly tokens: Model<VerificationTokenRecord>,
  ) {}

  async replace(token: NewVerificationToken): Promise<void> {
    await this.connection.transaction(async (session) => {
      await this.tokens.deleteMany({ userId: token.userId, purpose: token.purpose }, { session });
      await this.tokens.create([token], { session });
    });
  }

  async consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null> {
    const consumed = await this.tokens
      .findOneAndDelete({ tokenHash, purpose, expiresAt: { $gt: now } })
      .lean();
    return consumed?.userId ?? null;
  }

  async deleteExpired(now: Date): Promise<number> {
    const { deletedCount } = await this.tokens.deleteMany({ expiresAt: { $lte: now } });
    return deletedCount;
  }
}
