import { Reflector } from '@nestjs/core';
import type { Env } from '../../config/env.js';

/** The env var holding each auth rate limit (`<limit>/<duration>`). */
export const AUTH_RATE_LIMIT_ENV_KEYS = {
  register: 'AUTH_THROTTLE_REGISTER',
  login: 'AUTH_THROTTLE_LOGIN',
  /** Routes that send mail to an address given by the caller: forgot password, resend verification. */
  mail: 'AUTH_THROTTLE_MAIL',
  reset: 'AUTH_THROTTLE_RESET',
} as const satisfies Record<string, keyof Env>;

export type AuthRateLimit = keyof typeof AUTH_RATE_LIMIT_ENV_KEYS;

/**
 * Gives a route one of the stricter auth rate limits instead of THROTTLE_LIMIT. Limits come
 * from config rather than the decorator, so each deployment (and each test) can set its own.
 */
export const AuthThrottle = Reflector.createDecorator<AuthRateLimit>();
