import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { InjectRedis } from '../redis/redis.module.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Redis is unreachable' });
    }
  }
}
