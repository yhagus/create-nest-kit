// class-transformer reads the property types the compiler records through reflect-metadata, and
// the env is parsed before Nest has loaded it.
import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
  type ValidationError,
  type ValidationOptions,
  ValidateBy,
  validateSync,
} from 'class-validator';
import { DURATION_PATTERN, parseDuration } from '../common/duration.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../common/password-length.js';
import { parseRateLimit, RATE_LIMIT_PATTERN } from '../common/rate-limit.js';
import type { BaseEnv, EnvParseResult } from './env-contract.js';

const MIN_COOKIE_SECRET_LENGTH = 32;
const MIN_JWT_SECRET_LENGTH = 32;
const NODE_ENVS = ['development', 'production', 'test'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const MAIL_TRANSPORTS = ['smtp', 'resend', 'log'] as const;
const TRUE_WORDS: ReadonlySet<string> = new Set(['true', '1', 'yes', 'on', 'y', 'enabled']);
const FALSE_WORDS: ReadonlySet<string> = new Set(['false', '0', 'no', 'off', 'n', 'disabled']);
const DURATION_MESSAGE = 'expected <n>s|m|h|d, e.g. 15m';
const RATE_LIMIT_MESSAGE = 'expected <limit>/<duration>, e.g. 10/1m';

// Implicit conversion turns every non-empty string into `true` for a boolean property, so these
// transforms read the raw string from `obj` instead of the converted `value`.

/** `true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`, `y`/`n`, `enabled`/`disabled`, any case. */
const StringBool = (): PropertyDecorator =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (typeof raw !== 'string') return raw;
    const word = raw.toLowerCase();
    if (TRUE_WORDS.has(word)) return true;
    if (FALSE_WORDS.has(word)) return false;
    return raw;
  });

/** `"https://a.example, https://b.example"` → `['https://a.example', 'https://b.example']`. */
const OriginList = (): PropertyDecorator =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (typeof raw !== 'string') return raw;
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  });

/** Any URL the WHATWG parser accepts, `http://localhost:3000` included. */
const IsUrlString = (options?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: 'isUrlString',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && URL.canParse(value),
        defaultMessage: () => 'expected a URL',
      },
    },
    options,
  );

/** The env vars as read; `parseBaseEnv` converts durations and rate limits after validation. */
class EnvironmentVariables {
  @IsIn(NODE_ENVS)
  NODE_ENV: BaseEnv['NODE_ENV'] = 'development';

  @IsInt()
  @IsPositive()
  PORT: number = 3000;

  @IsString()
  @MinLength(1)
  APP_NAME!: string;

  @IsUrlString()
  APP_URL!: string;

  @IsUrlString()
  WEB_APP_URL!: string;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: BaseEnv['LOG_LEVEL'] = 'info';

  @OriginList()
  @IsUrlString({ each: true })
  CORS_ORIGINS!: string[];

  @StringBool()
  @IsBoolean()
  CSRF_ENABLED: boolean = true;

  @IsString()
  @MinLength(MIN_COOKIE_SECRET_LENGTH)
  COOKIE_SECRET!: string;

  @StringBool()
  @IsBoolean()
  SWAGGER_ENABLED: boolean = false;

  @IsUrlString()
  REDIS_URL!: string;

  @IsIn(MAIL_TRANSPORTS)
  MAIL_TRANSPORT!: BaseEnv['MAIL_TRANSPORT'];

  @ValidateIf((env: EnvironmentVariables) => env.MAIL_TRANSPORT === 'smtp')
  @IsNotEmpty({ message: 'required when MAIL_TRANSPORT=smtp' })
  SMTP_URL?: string;

  @ValidateIf((env: EnvironmentVariables) => env.MAIL_TRANSPORT === 'resend')
  @IsNotEmpty({ message: 'required when MAIL_TRANSPORT=resend' })
  RESEND_API_KEY?: string;

  @IsString()
  @MinLength(1)
  MAIL_FROM!: string;

  @IsInt()
  @IsPositive()
  THROTTLE_TTL: number = 60_000;

  @IsInt()
  @IsPositive()
  THROTTLE_LIMIT: number = 100;

  @Matches(RATE_LIMIT_PATTERN, { message: RATE_LIMIT_MESSAGE })
  AUTH_THROTTLE_REGISTER: string = '5/1m';

  @Matches(RATE_LIMIT_PATTERN, { message: RATE_LIMIT_MESSAGE })
  AUTH_THROTTLE_LOGIN: string = '10/1m';

  @Matches(RATE_LIMIT_PATTERN, { message: RATE_LIMIT_MESSAGE })
  AUTH_THROTTLE_MAIL: string = '3/15m';

  @Matches(RATE_LIMIT_PATTERN, { message: RATE_LIMIT_MESSAGE })
  AUTH_THROTTLE_RESET: string = '10/15m';

  @StringBool()
  @IsBoolean()
  TRUST_PROXY: boolean = false;

  @IsString()
  @MinLength(MIN_JWT_SECRET_LENGTH)
  JWT_SECRET!: string;

  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  ACCESS_TOKEN_TTL: string = '15m';

  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  REFRESH_TOKEN_TTL: string = '30d';

  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  SESSION_ABSOLUTE_TTL: string = '90d';

  @StringBool()
  @IsBoolean()
  EMAIL_VERIFICATION_ENABLED: boolean = true;

  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  EMAIL_VERIFICATION_TTL: string = '24h';

  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  PASSWORD_RESET_TTL: string = '1h';

  @IsOptional()
  @IsEmail()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  SEED_ADMIN_PASSWORD?: string;
}

/** The app's env vars, validated and converted; database vars are read by `parseDatabaseEnv`. */
export function parseBaseEnv(source: Record<string, string | undefined>): EnvParseResult<BaseEnv> {
  const variables = plainToInstance(EnvironmentVariables, source, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(variables, { skipMissingProperties: false });
  if (errors.length > 0) {
    return { success: false, issues: errors.flatMap(toEnvIssues) };
  }
  return { success: true, env: toBaseEnv(variables) };
}

function toEnvIssues(error: ValidationError): { key: string; message: string }[] {
  return Object.values(error.constraints ?? {}).map((message) => ({
    key: error.property,
    message,
  }));
}

/** Only the declared variables: the instance also holds every other key of `source`. */
function toBaseEnv(variables: EnvironmentVariables): BaseEnv {
  return {
    NODE_ENV: variables.NODE_ENV,
    PORT: variables.PORT,
    APP_NAME: variables.APP_NAME,
    APP_URL: variables.APP_URL,
    WEB_APP_URL: variables.WEB_APP_URL,
    LOG_LEVEL: variables.LOG_LEVEL,
    CORS_ORIGINS: variables.CORS_ORIGINS,
    CSRF_ENABLED: variables.CSRF_ENABLED,
    COOKIE_SECRET: variables.COOKIE_SECRET,
    SWAGGER_ENABLED: variables.SWAGGER_ENABLED,
    REDIS_URL: variables.REDIS_URL,
    MAIL_TRANSPORT: variables.MAIL_TRANSPORT,
    SMTP_URL: variables.SMTP_URL,
    RESEND_API_KEY: variables.RESEND_API_KEY,
    MAIL_FROM: variables.MAIL_FROM,
    THROTTLE_TTL: variables.THROTTLE_TTL,
    THROTTLE_LIMIT: variables.THROTTLE_LIMIT,
    AUTH_THROTTLE_REGISTER: parseRateLimit(variables.AUTH_THROTTLE_REGISTER),
    AUTH_THROTTLE_LOGIN: parseRateLimit(variables.AUTH_THROTTLE_LOGIN),
    AUTH_THROTTLE_MAIL: parseRateLimit(variables.AUTH_THROTTLE_MAIL),
    AUTH_THROTTLE_RESET: parseRateLimit(variables.AUTH_THROTTLE_RESET),
    TRUST_PROXY: variables.TRUST_PROXY,
    JWT_SECRET: variables.JWT_SECRET,
    ACCESS_TOKEN_TTL: parseDuration(variables.ACCESS_TOKEN_TTL),
    REFRESH_TOKEN_TTL: parseDuration(variables.REFRESH_TOKEN_TTL),
    SESSION_ABSOLUTE_TTL: parseDuration(variables.SESSION_ABSOLUTE_TTL),
    EMAIL_VERIFICATION_ENABLED: variables.EMAIL_VERIFICATION_ENABLED,
    EMAIL_VERIFICATION_TTL: parseDuration(variables.EMAIL_VERIFICATION_TTL),
    PASSWORD_RESET_TTL: parseDuration(variables.PASSWORD_RESET_TTL),
    SEED_ADMIN_EMAIL: variables.SEED_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: variables.SEED_ADMIN_PASSWORD,
  };
}
