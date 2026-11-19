export const TEST_WEB_ORIGIN = 'http://localhost:5173';

/**
 * Every environment variable the app needs except the containers' URLs, for the test apps and
 * the package scripts the tests run. Tests override single values.
 */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  APP_NAME: 'test-app',
  APP_URL: 'http://localhost:3000',
  WEB_APP_URL: TEST_WEB_ORIGIN,
  // Raise to 'debug' to see the app's logs while debugging a test.
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: TEST_WEB_ORIGIN,
  CSRF_ENABLED: 'true',
  COOKIE_SECRET: 'test-cookie-secret-of-at-least-32-characters',
  SWAGGER_ENABLED: 'false',
  // Mail goes to the Mailpit container; tests read it back with tests/support/mail.ts.
  MAIL_TRANSPORT: 'smtp',
  MAIL_FROM: 'no-reply@example.com',
  THROTTLE_TTL: '60000',
  THROTTLE_LIMIT: '1000',
  // High enough for any test; the rate-limit tests lower them.
  AUTH_THROTTLE_REGISTER: '1000/1m',
  AUTH_THROTTLE_LOGIN: '1000/1m',
  AUTH_THROTTLE_MAIL: '1000/1m',
  AUTH_THROTTLE_RESET: '1000/1m',
  JWT_SECRET: 'test-jwt-secret-of-at-least-32-characters',
};
