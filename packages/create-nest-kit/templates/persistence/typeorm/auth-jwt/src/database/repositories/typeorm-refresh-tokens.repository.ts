import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshTokensRepository } from '../../auth/refresh-tokens.repository.js';
import { SessionRefreshTokenEntity } from '../entities/session-refresh-token.entity.js';

@Injectable()
export class TypeOrmRefreshTokensRepository implements RefreshTokensRepository {
  constructor(
    @InjectRepository(SessionRefreshTokenEntity)
    private readonly refreshTokens: Repository<SessionRefreshTokenEntity>,
  ) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    await this.refreshTokens.insert({ sessionId, tokenHash });
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    const { affected } = await this.refreshTokens.update(
      { sessionId, tokenHash: currentHash },
      { tokenHash: nextHash },
    );
    return affected === 1;
  }
}
