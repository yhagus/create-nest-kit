import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.js';

/** Typed access to the validated environment: `config.get('REDIS_URL')`. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<Key extends keyof Env>(key: Key): Env[Key] {
    return this.config.get(key, { infer: true });
  }
}
