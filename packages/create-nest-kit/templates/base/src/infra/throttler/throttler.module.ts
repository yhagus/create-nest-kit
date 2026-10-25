import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import { AppThrottlerGuard } from './app-throttler.guard.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

/**
 * Rate-limits every route per client ip (THROTTLE_TTL, THROTTLE_LIMIT). Give a route an auth
 * limit with `@AuthThrottle()`, tune it with `@Throttle()`, opt out with `@SkipThrottle()`.
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS_CLIENT],
      useFactory: (config: AppConfig, redis: Redis) => ({
        throttlers: [{ ttl: config.get('THROTTLE_TTL'), limit: config.get('THROTTLE_LIMIT') }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class ThrottlerModule {}
