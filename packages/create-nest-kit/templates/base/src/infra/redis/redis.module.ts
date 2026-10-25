import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Injects the shared ioredis client: `constructor(@InjectRedis() redis: Redis)`. */
export const InjectRedis = (): ParameterDecorator => Inject(REDIS_CLIENT);

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new Redis(config.get('REDIS_URL')),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // QUIT lets pending commands finish, unlike disconnect().
    await this.redis.quit();
  }
}
