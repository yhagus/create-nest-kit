import { z } from 'zod';
import { DURATION_PATTERN, parseDuration } from '../common/duration.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../common/password-length.js';
import { parseRateLimit, RATE_LIMIT_PATTERN } from '../common/rate-limit.js';
import type { BaseEnv, EnvParseResult } from './env-contract.js';

const MIN_COOKIE_SECRET_LENGTH = 32;
const MIN_JWT_SECRET_LENGTH = 32;

/** `"https://a.example, https://b.example"` → `['https://a.example', 'https://b.example']`. */
const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()));

/** `15m`, `30d`, ... read as milliseconds. */
const duration = (defaultValue: string) =>
  z
    .string()
    .regex(DURATION_PATTERN, 'expected <n>s|m|h|d, e.g. 15m')
    .default(defaultValue)
    .transform(parseDuration);

/** `10/1m` → at most 10 requests per minute: `{ limit: 10, ttl: 60000 }`. */
const rateLimit = (defaultValue: string) =>
  z
    .string()
    .regex(RATE_LIMIT_PATTERN, 'expected <limit>/<duration>, e.g. 10/1m')
    .default(defaultValue)
    .transform(parseRateLimit);

const baseEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_NAME: z.string().min(1),
    APP_URL: z.url(),
    WEB_APP_URL: z.url(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: originList,
    CSRF_ENABLED: z.stringbool().default(true),
    COOKIE_SECRET: z.string().min(MIN_COOKIE_SECRET_LENGTH),
    SWAGGER_ENABLED: z.stringbool().default(false),
    REDIS_URL: z.url(),
    MAIL_TRANSPORT: z.enum(['smtp', 'resend', 'log']),
    SMTP_URL: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().min(1),
    THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    AUTH_THROTTLE_REGISTER: rateLimit('5/1m'),
    AUTH_THROTTLE_LOGIN: rateLimit('10/1m'),
    AUTH_THROTTLE_MAIL: rateLimit('3/15m'),
    AUTH_THROTTLE_RESET: rateLimit('10/15m'),
    TRUST_PROXY: z.stringbool().default(false),
    JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
    ACCESS_TOKEN_TTL: duration('15m'),
    REFRESH_TOKEN_TTL: duration('30d'),
    SESSION_ABSOLUTE_TTL: duration('90d'),
    EMAIL_VERIFICATION_ENABLED: z.stringbool().default(true),
    EMAIL_VERIFICATION_TTL: duration('24h'),
    PASSWORD_RESET_TTL: duration('1h'),
    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).optional(),
  })
  .superRefine((env, context) => {
    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_URL) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_URL'],
        message: 'required when MAIL_TRANSPORT=smtp',
      });
    }
    if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'required when MAIL_TRANSPORT=resend',
      });
    }
  });

/** The app's env vars, validated and converted; database vars are read by `parseDatabaseEnv`. */
export function parseBaseEnv(source: Record<string, string | undefined>): EnvParseResult<BaseEnv> {
  const result = baseEnvSchema.safeParse(source);
  if (result.success) {
    return { success: true, env: result.data };
  }
  const issues = result.error.issues.map((issue) => ({
    key: issue.path.join('.'),
    message: issue.message,
  }));
  return { success: false, issues };
}
