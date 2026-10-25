import * as v from 'valibot';
import { DURATION_PATTERN, parseDuration } from '../common/duration.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../common/password-length.js';
import { parseRateLimit, RATE_LIMIT_PATTERN } from '../common/rate-limit.js';
import type { BaseEnv, EnvParseResult } from './env-contract.js';

// Env vars are strings, so are the defaults: each one goes through the same conversion as a set value.

const MIN_COOKIE_SECRET_LENGTH = 32;
const MIN_JWT_SECRET_LENGTH = 32;

const nonEmptyString = v.pipe(v.string(), v.minLength(1));
const url = v.pipe(v.string(), v.url());
const positiveInteger = v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1));
/** `true`, `yes`, `on`, `1`, ... or `false`, `no`, `off`, `0`, ..., in any case. */
const stringBoolean = v.pipe(v.string(), v.parseBoolean());

/** `"https://a.example, https://b.example"` → `['https://a.example', 'https://b.example']`. */
const originList = v.pipe(
  v.string(),
  v.transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  ),
  v.array(url),
);

/** `15m`, `30d`, ... read as milliseconds. */
const duration = (defaultValue: string) =>
  v.optional(
    v.pipe(
      v.string(),
      v.regex(DURATION_PATTERN, 'expected <n>s|m|h|d, e.g. 15m'),
      v.transform(parseDuration),
    ),
    defaultValue,
  );

/** `10/1m` → at most 10 requests per minute: `{ limit: 10, ttl: 60000 }`. */
const rateLimit = (defaultValue: string) =>
  v.optional(
    v.pipe(
      v.string(),
      v.regex(RATE_LIMIT_PATTERN, 'expected <limit>/<duration>, e.g. 10/1m'),
      v.transform(parseRateLimit),
    ),
    defaultValue,
  );

const baseEnvSchema = v.pipe(
  v.object({
    NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
    PORT: v.optional(positiveInteger, '3000'),
    APP_NAME: nonEmptyString,
    APP_URL: url,
    WEB_APP_URL: url,
    LOG_LEVEL: v.optional(
      v.picklist(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
      'info',
    ),
    CORS_ORIGINS: originList,
    CSRF_ENABLED: v.optional(stringBoolean, 'true'),
    COOKIE_SECRET: v.pipe(v.string(), v.minLength(MIN_COOKIE_SECRET_LENGTH)),
    SWAGGER_ENABLED: v.optional(stringBoolean, 'false'),
    REDIS_URL: url,
    MAIL_TRANSPORT: v.picklist(['smtp', 'resend', 'log']),
    SMTP_URL: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    MAIL_FROM: nonEmptyString,
    THROTTLE_TTL: v.optional(positiveInteger, '60000'),
    THROTTLE_LIMIT: v.optional(positiveInteger, '100'),
    AUTH_THROTTLE_REGISTER: rateLimit('5/1m'),
    AUTH_THROTTLE_LOGIN: rateLimit('10/1m'),
    AUTH_THROTTLE_MAIL: rateLimit('3/15m'),
    AUTH_THROTTLE_RESET: rateLimit('10/15m'),
    TRUST_PROXY: v.optional(stringBoolean, 'false'),
    JWT_SECRET: v.pipe(v.string(), v.minLength(MIN_JWT_SECRET_LENGTH)),
    ACCESS_TOKEN_TTL: duration('15m'),
    REFRESH_TOKEN_TTL: duration('30d'),
    SESSION_ABSOLUTE_TTL: duration('90d'),
    EMAIL_VERIFICATION_ENABLED: v.optional(stringBoolean, 'true'),
    EMAIL_VERIFICATION_TTL: duration('24h'),
    PASSWORD_RESET_TTL: duration('1h'),
    SEED_ADMIN_EMAIL: v.optional(v.pipe(v.string(), v.email())),
    SEED_ADMIN_PASSWORD: v.optional(
      v.pipe(v.string(), v.minLength(PASSWORD_MIN_LENGTH), v.maxLength(PASSWORD_MAX_LENGTH)),
    ),
  }),
  v.forward(
    v.partialCheck(
      [['MAIL_TRANSPORT'], ['SMTP_URL']],
      (env) => env.MAIL_TRANSPORT !== 'smtp' || Boolean(env.SMTP_URL),
      'required when MAIL_TRANSPORT=smtp',
    ),
    ['SMTP_URL'],
  ),
  v.forward(
    v.partialCheck(
      [['MAIL_TRANSPORT'], ['RESEND_API_KEY']],
      (env) => env.MAIL_TRANSPORT !== 'resend' || Boolean(env.RESEND_API_KEY),
      'required when MAIL_TRANSPORT=resend',
    ),
    ['RESEND_API_KEY'],
  ),
);

/** The app's env vars, validated and converted; database vars are read by `parseDatabaseEnv`. */
export function parseBaseEnv(source: Record<string, string | undefined>): EnvParseResult<BaseEnv> {
  const result = v.safeParse(baseEnvSchema, source);
  if (result.success) {
    return { success: true, env: result.output };
  }
  const issues = result.issues.map((issue) => ({
    key: v.getDotPath(issue) ?? '',
    message: issue.message,
  }));
  return { success: false, issues };
}
