import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';

const KEY_PREFIX = 'auth:revoked-session:';

/**
 * Revoked session ids, checked on every authenticated request so that access tokens stop
 * working the moment their session is revoked. An entry only has to outlive the access
 * tokens issued before the revocation, so it expires after ACCESS_TOKEN_TTL.
 */
@Injectable()
export class SessionDenyList {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async add(sessionIds: readonly string[]): Promise<void> {
    const ttlMs = this.config.get('ACCESS_TOKEN_TTL');
    await Promise.all(sessionIds.map((id) => this.redis.set(keyOf(id), '1', 'PX', ttlMs)));
  }

  async includes(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(keyOf(sessionId))) === 1;
  }
}

function keyOf(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}
