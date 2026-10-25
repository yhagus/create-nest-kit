import { type } from 'arktype';
import { DURATION_PATTERN, parseDuration } from '../common/duration.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../common/password-length.js';
import { parseRateLimit, RATE_LIMIT_PATTERN } from '../common/rate-limit.js';
import type { BaseEnv, EnvParseResult } from './env-contract.js';

const MIN_COOKIE_SECRET_LENGTH = 32;
const MIN_JWT_SECRET_LENGTH = 32;
const TRUE_WORDS: ReadonlySet<string> = new Set(['true', '1', 'yes', 'on', 'y', 'enabled']);
const FALSE_WORDS: ReadonlySet<string> = new Set(['false', '0', 'no', 'off', 'n', 'disabled']);

/** `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`, `y`/`n`, `enabled`/`disabled`, any case. */
const stringBool = type('string').pipe((value, context) => {
  const word = value.toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return context.error('true or false (also 1/0, yes/no, on/off, y/n, enabled/disabled)');
});

const positiveInteger = type('string.integer.parse |> number > 0');

/** `"https://a.example, https://b.example"` → `['https://a.example', 'https://b.example']`. */
const originList = type('string')
  .pipe((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .to('string.url[]');

/** `15m`, `30d`, ... read as milliseconds. */
const duration = type(DURATION_PATTERN).describe('<n>s|m|h|d, e.g. 15m').pipe(parseDuration);

/** `10/1m` → at most 10 requests per minute: `{ limit: 10, ttl: 60000 }`. */
const rateLimit = type(RATE_LIMIT_PATTERN)
  .describe('<limit>/<duration>, e.g. 10/1m')
  .pipe(parseRateLimit);

const baseEnvSchema = type({
  // Every other variable of the environment is left out of the result.
  '+': 'delete',
  NODE_ENV: "'development' | 'production' | 'test' = 'development'",
  PORT: positiveInteger.default('3000'),
  APP_NAME: 'string > 0',
  APP_URL: 'string.url',
  WEB_APP_URL: 'string.url',
  LOG_LEVEL: "'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent' = 'info'",
  CORS_ORIGINS: originList,
  CSRF_ENABLED: stringBool.default('true'),
  COOKIE_SECRET: `string >= ${MIN_COOKIE_SECRET_LENGTH}`,
  SWAGGER_ENABLED: stringBool.default('false'),
  REDIS_URL: 'string.url',
  MAIL_TRANSPORT: "'smtp' | 'resend' | 'log'",
  'SMTP_URL?': 'string',
  'RESEND_API_KEY?': 'string',
  MAIL_FROM: 'string > 0',
  THROTTLE_TTL: positiveInteger.default('60000'),
  THROTTLE_LIMIT: positiveInteger.default('100'),
  AUTH_THROTTLE_REGISTER: rateLimit.default('5/1m'),
  AUTH_THROTTLE_LOGIN: rateLimit.default('10/1m'),
  AUTH_THROTTLE_MAIL: rateLimit.default('3/15m'),
  AUTH_THROTTLE_RESET: rateLimit.default('10/15m'),
  TRUST_PROXY: stringBool.default('false'),
  JWT_SECRET: `string >= ${MIN_JWT_SECRET_LENGTH}`,
  ACCESS_TOKEN_TTL: duration.default('15m'),
  REFRESH_TOKEN_TTL: duration.default('30d'),
  SESSION_ABSOLUTE_TTL: duration.default('90d'),
  EMAIL_VERIFICATION_ENABLED: stringBool.default('true'),
  EMAIL_VERIFICATION_TTL: duration.default('24h'),
  PASSWORD_RESET_TTL: duration.default('1h'),
  'SEED_ADMIN_EMAIL?': 'string.email',
  'SEED_ADMIN_PASSWORD?': `${PASSWORD_MIN_LENGTH} <= string <= ${PASSWORD_MAX_LENGTH}`,
}).narrow((env, context) => {
  if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_URL) {
    return context.reject(requiredFor('SMTP_URL', 'MAIL_TRANSPORT=smtp'));
  }
  if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
    return context.reject(requiredFor('RESEND_API_KEY', 'MAIL_TRANSPORT=resend'));
  }
  return true;
});

/** An error at `key` reading "must be set when <condition>". */
function requiredFor(key: string, condition: string) {
  // An empty `actual` leaves out the "(was …)" part, which would show the whole env.
  return { path: [key], expected: `set when ${condition}`, actual: '' };
}

/** The app's env vars, validated and converted; database vars are read by `parseDatabaseEnv`. */
export function parseBaseEnv(source: Record<string, string | undefined>): EnvParseResult<BaseEnv> {
  const result = baseEnvSchema(withoutUnsetVariables(source));
  if (!(result instanceof type.errors)) {
    return { success: true, env: result };
  }
  const issues = result.map((error) => ({ key: error.path.join('.'), message: error.problem }));
  return { success: false, issues };
}

/** ArkType rejects a key whose value is `undefined`; an unset variable is simply missing. */
function withoutUnsetVariables(source: Record<string, string | undefined>): Record<string, string> {
  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return Object.fromEntries(entries);
}
