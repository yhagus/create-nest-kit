import type { RateLimit } from '../common/rate-limit.js';

// What every env parser returns: the validation layer's `parseBaseEnv` (env.schema.ts) and the
// database layer's `parseDatabaseEnv` (database.env.ts). `parseEnv` in env.ts combines them.

/** The app's settings, read from env vars. Durations are in milliseconds. */
export interface BaseEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_NAME: string;
  APP_URL: string;
  WEB_APP_URL: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** From a comma-separated list. */
  CORS_ORIGINS: string[];
  CSRF_ENABLED: boolean;
  COOKIE_SECRET: string;
  SWAGGER_ENABLED: boolean;
  REDIS_URL: string;
  MAIL_TRANSPORT: 'smtp' | 'resend' | 'log';
  /** Set whenever MAIL_TRANSPORT is `smtp`. */
  SMTP_URL?: string;
  /** Set whenever MAIL_TRANSPORT is `resend`. */
  RESEND_API_KEY?: string;
  MAIL_FROM: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  AUTH_THROTTLE_REGISTER: RateLimit;
  AUTH_THROTTLE_LOGIN: RateLimit;
  AUTH_THROTTLE_MAIL: RateLimit;
  AUTH_THROTTLE_RESET: RateLimit;
  TRUST_PROXY: boolean;
  JWT_SECRET: string;
  ACCESS_TOKEN_TTL: number;
  REFRESH_TOKEN_TTL: number;
  SESSION_ABSOLUTE_TTL: number;
  EMAIL_VERIFICATION_ENABLED: boolean;
  EMAIL_VERIFICATION_TTL: number;
  PASSWORD_RESET_TTL: number;
  /** Only `db:seed` reads these; the app runs without them. */
  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
}

/** An env var that is missing or invalid. */
export interface EnvIssue {
  key: string;
  message: string;
}

export type EnvParseResult<Env> =
  { success: true; env: Env } | { success: false; issues: EnvIssue[] };

/** Thrown at startup when env vars are missing or invalid; lists every one of them. */
export class InvalidEnvError extends Error {
  constructor(issues: readonly EnvIssue[]) {
    const lines = issues.map(({ key, message }) => `  ${key}: ${message}`);
    super(`Invalid environment variables:\n${lines.join('\n')}`);
  }
}
