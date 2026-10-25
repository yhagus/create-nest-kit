import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RefreshTokensRepository } from '../../auth/refresh-tokens.repository.js';
import { SessionRefreshTokenRecord } from '../schemas/session-refresh-token.schema.js';

@Injectable()
export class MongooseRefreshTokensRepository implements RefreshTokensRepository {
  constructor(
    @InjectModel(SessionRefreshTokenRecord.name)
    private readonly refreshTokens: Model<SessionRefreshTokenRecord>,
  ) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    await this.refreshTokens.create({ _id: sessionId, tokenHash });
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    const { modifiedCount } = await this.refreshTokens.updateOne(
      { _id: sessionId, tokenHash: currentHash },
      { $set: { tokenHash: nextHash } },
    );
    return modifiedCount === 1;
  }
}
