import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { AppConfig } from '../../config/app-config.js';
import { AUTH_RATE_LIMIT_ENV_KEYS, AuthThrottle } from './auth-throttle.js';

/** ThrottlerGuard that applies the configured auth limit to routes marked `@AuthThrottle()`. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: AppConfig,
  ) {
    super(options, storage, reflector);
  }

  protected override handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const authRateLimit = this.reflector.get(AuthThrottle, request.context.getHandler());
    if (authRateLimit === undefined) return super.handleRequest(request);

    const { limit, ttl } = this.config.get(AUTH_RATE_LIMIT_ENV_KEYS[authRateLimit]);
    return super.handleRequest({ ...request, limit, ttl, blockDuration: ttl });
  }
}
