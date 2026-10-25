import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { RefreshTokensRepository } from '../../auth/refresh-tokens.repository.js';
import { SessionRefreshTokenEntity } from '../entities/session-refresh-token.entity.js';

/** Every method runs on its own fork of the EntityManager, so it works outside an HTTP request. */
@Injectable()
export class MikroOrmRefreshTokensRepository implements RefreshTokensRepository {
  constructor(private readonly em: EntityManager) {}

  async create(sessionId: string, tokenHash: string): Promise<void> {
    await this.em.fork().insert(SessionRefreshTokenEntity, { sessionId, tokenHash });
  }

  async rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean> {
    const rotated = await this.em
      .fork()
      .nativeUpdate(
        SessionRefreshTokenEntity,
        { sessionId, tokenHash: currentHash },
        { tokenHash: nextHash },
      );
    return rotated === 1;
  }
}
