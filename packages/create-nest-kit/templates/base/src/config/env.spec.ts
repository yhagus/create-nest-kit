import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';
import { parseBaseEnv } from './env.schema.js';

// The same expectations run in every generated project, whichever validation library parses
// the env, so they pin down one behaviour for all of them.

const COOKIE_SECRET = 'a-cookie-secret-of-at-least-32-characters';
const JWT_SECRET = 'a-jwt-secret-of-at-least-32-characters';

/** Only the variables without a default. */
const REQUIRED = {
  APP_NAME: 'api',
  APP_URL: 'https://api.example.com',
  WEB_APP_URL: 'https://example.com',
  CORS_ORIGINS: 'https://example.com',
  COOKIE_SECRET,
  REDIS_URL: 'redis://localhost:6379',
  MAIL_TRANSPORT: 'log',
  MAIL_FROM: 'no-reply@example.com',
  JWT_SECRET,
};

describe('parseBaseEnv', () => {
  it('converts booleans, numbers, origin lists, durations and rate limits', () => {
    const result = parseBaseEnv({
      ...REQUIRED,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://example.com, https://admin.example.com,',
      CSRF_ENABLED: 'false',
      SWAGGER_ENABLED: 'yes',
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_123',
      THROTTLE_TTL: '30000',
      THROTTLE_LIMIT: '50',
      AUTH_THROTTLE_REGISTER: '2/1h',
      AUTH_THROTTLE_LOGIN: '20/30s',
      AUTH_THROTTLE_MAIL: '1/1d',
      AUTH_THROTTLE_RESET: '4/10m',
      TRUST_PROXY: '1',
      ACCESS_TOKEN_TTL: '5m',
      REFRESH_TOKEN_TTL: '7d',
      SESSION_ABSOLUTE_TTL: '30d',
      EMAIL_VERIFICATION_ENABLED: 'off',
      EMAIL_VERIFICATION_TTL: '2h',
      PASSWORD_RESET_TTL: '45s',
      SEED_ADMIN_EMAIL: 'admin@example.com',
      SEED_ADMIN_PASSWORD: 'a long admin password',
      PATH: '/usr/bin',
    });

    expect(result).toEqual({
      success: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        APP_NAME: 'api',
        APP_URL: 'https://api.example.com',
        WEB_APP_URL: 'https://example.com',
        LOG_LEVEL: 'warn',
        CORS_ORIGINS: ['https://example.com', 'https://admin.example.com'],
        CSRF_ENABLED: false,
        COOKIE_SECRET,
        SWAGGER_ENABLED: true,
        REDIS_URL: 'redis://localhost:6379',
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_123',
        MAIL_FROM: 'no-reply@example.com',
        THROTTLE_TTL: 30_000,
        THROTTLE_LIMIT: 50,
        AUTH_THROTTLE_REGISTER: { limit: 2, ttl: 3_600_000 },
        AUTH_THROTTLE_LOGIN: { limit: 20, ttl: 30_000 },
        AUTH_THROTTLE_MAIL: { limit: 1, ttl: 86_400_000 },
        AUTH_THROTTLE_RESET: { limit: 4, ttl: 600_000 },
        TRUST_PROXY: true,
        JWT_SECRET,
        ACCESS_TOKEN_TTL: 300_000,
        REFRESH_TOKEN_TTL: 604_800_000,
        SESSION_ABSOLUTE_TTL: 2_592_000_000,
        EMAIL_VERIFICATION_ENABLED: false,
        EMAIL_VERIFICATION_TTL: 7_200_000,
        PASSWORD_RESET_TTL: 45_000,
        SEED_ADMIN_EMAIL: 'admin@example.com',
        SEED_ADMIN_PASSWORD: 'a long admin password',
      },
    });
  });

  it('fills in the defaults', () => {
    const result = parseBaseEnv(REQUIRED);

    expect(result).toEqual({
      success: true,
      env: {
        ...REQUIRED,
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'info',
        CORS_ORIGINS: ['https://example.com'],
        CSRF_ENABLED: true,
        SWAGGER_ENABLED: false,
        THROTTLE_TTL: 60_000,
        THROTTLE_LIMIT: 100,
        AUTH_THROTTLE_REGISTER: { limit: 5, ttl: 60_000 },
        AUTH_THROTTLE_LOGIN: { limit: 10, ttl: 60_000 },
        AUTH_THROTTLE_MAIL: { limit: 3, ttl: 900_000 },
        AUTH_THROTTLE_RESET: { limit: 10, ttl: 900_000 },
        TRUST_PROXY: false,
        ACCESS_TOKEN_TTL: 900_000,
        REFRESH_TOKEN_TTL: 2_592_000_000,
        SESSION_ABSOLUTE_TTL: 7_776_000_000,
        EMAIL_VERIFICATION_ENABLED: true,
        EMAIL_VERIFICATION_TTL: 86_400_000,
        PASSWORD_RESET_TTL: 3_600_000,
      },
    });
  });

  it.each([
    ['smtp', 'SMTP_URL'],
    ['resend', 'RESEND_API_KEY'],
  ])('requires the settings of MAIL_TRANSPORT=%s', (transport, key) => {
    const result = parseBaseEnv({ ...REQUIRED, MAIL_TRANSPORT: transport });

    expect(result).toEqual({ success: false, issues: [{ key, message: expect.any(String) }] });
  });
});

describe('parseEnv', () => {
  it("lists every invalid variable, the app's and the database's together", () => {
    const source = { ...REQUIRED, JWT_SECRET: 'short', ACCESS_TOKEN_TTL: '15' };

    expect(() => parseEnv(source)).toThrow(/^Invalid environment variables:/);
    expect(() => parseEnv(source)).toThrow(/JWT_SECRET/);
    expect(() => parseEnv(source)).toThrow(/ACCESS_TOKEN_TTL/);
    expect(() => parseEnv(source)).toThrow(/DATABASE_URL|MONGODB_URI/);
  });
});
