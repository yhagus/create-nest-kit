import type { LayerManifest } from './types.ts';

/** Versions shared by more than one layer. Nest packages move in lockstep. */
export const NEST_VERSION = '12.2.0';
export const TESTCONTAINERS_VERSION = '12.2.1';

export const baseLayer: LayerManifest = {
  id: 'base',
  status: 'ready',
  when: () => true,
  dependencies: {
    '@nestjs/bullmq': '12.0.0',
    '@nestjs/common': NEST_VERSION,
    '@nestjs/config': '12.0.1',
    '@nestjs/core': NEST_VERSION,
    '@nestjs/mail': '0.0.1',
    '@nestjs/swagger': '12.0.4',
    '@nestjs/terminus': '12.1.0',
    '@nestjs/throttler': '6.7.1',
    bullmq: '6.4.2',
    ioredis: '6.0.0',
    'nestjs-pino': '5.3.1',
    pino: '10.4.0',
    'pino-http': '11.0.0',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
  },
  devDependencies: {
    '@nestjs/cli': '12.0.10',
    '@nestjs/schematics': '12.0.10',
    '@nestjs/testing': NEST_VERSION,
    '@swc/core': '1.16.20',
    '@testcontainers/redis': TESTCONTAINERS_VERSION,
    '@types/node': '24.19.2',
    '@vitest/coverage-v8': '5.0.5',
    oxlint: '1.89.0',
    'pino-pretty': '13.2.0',
    prettier: '3.9.10',
    testcontainers: TESTCONTAINERS_VERSION,
    typescript: '6.0.3',
    'unplugin-swc': '2.0.0',
    vite: '8.3.5',
    vitest: '5.0.5',
  },
  scripts: {
    build: 'nest build',
    start: 'nest start',
    'start:dev': 'nest start --watch',
    'start:debug': 'nest start --debug --watch',
    'start:prod': 'node dist/main.js',
    lint: 'oxlint src test',
    typecheck: 'tsc --noEmit',
    format: 'prettier --write .',
    'format:check': 'prettier --check .',
    test: 'vitest run',
    'test:watch': 'vitest',
    'test:cov': 'vitest run --coverage',
    'test:e2e': 'vitest run --config vitest.config.e2e.ts',
    // Through the Nest CLI (tsc), not tsx: esbuild doesn't emit the decorator metadata DI needs.
    'db:seed': 'nest start --entryFile seed/seed',
  },
  packageJson: {
    pnpm: {
      onlyBuiltDependencies: ['@swc/core', 'msgpackr-extract'],
      // Optional native add-ons of Testcontainers' SSH and gRPC clients and a telemetry hook: not needed.
      ignoredBuiltDependencies: ['@scarf/scarf', 'cpu-features', 'protobufjs', 'ssh2'],
    },
  },
  env: [
    { key: 'NODE_ENV', value: 'development', comment: 'development | production | test' },
    { key: 'PORT', value: '3000' },
    { key: 'APP_NAME', value: (options) => options.name },
    { key: 'APP_URL', value: 'http://localhost:3000', comment: 'Public URL of this API' },
    {
      key: 'WEB_APP_URL',
      value: 'http://localhost:5173',
      comment: 'Front-end URL, used to build links in mails',
    },
    { key: 'LOG_LEVEL', value: 'debug', comment: 'fatal | error | warn | info | debug | trace' },
    {
      key: 'CORS_ORIGINS',
      value: 'http://localhost:5173',
      comment: 'Comma-separated origins allowed to call the API with credentials',
    },
    {
      key: 'CSRF_ENABLED',
      value: (options) => String(options.csrf),
      comment: 'Reject cross-site, state-changing requests from browsers',
    },
    { key: 'COOKIE_SECRET', value: 'change-me-to-at-least-32-characters', secret: true },
    { key: 'SWAGGER_ENABLED', value: 'true', comment: 'Serve the OpenAPI UI at /docs' },
    { key: 'REDIS_URL', value: 'redis://localhost:6379' },
    { key: 'MAIL_TRANSPORT', value: 'smtp', comment: 'smtp | resend | log' },
    { key: 'SMTP_URL', value: 'smtp://localhost:1025', comment: 'Mailpit in development' },
    { key: 'RESEND_API_KEY', value: '', comment: 'Required when MAIL_TRANSPORT=resend' },
    { key: 'MAIL_FROM', value: 'no-reply@example.com' },
    { key: 'THROTTLE_TTL', value: '60000', comment: 'Rate-limit window in milliseconds' },
    { key: 'THROTTLE_LIMIT', value: '100', comment: 'Requests allowed per window and client' },
    {
      key: 'AUTH_THROTTLE_REGISTER',
      value: '5/1m',
      comment: 'Auth rate limits per client ip: <limit>/<duration>',
    },
    { key: 'AUTH_THROTTLE_LOGIN', value: '10/1m' },
    { key: 'AUTH_THROTTLE_MAIL', value: '3/15m', comment: 'Forgot password, resend verification' },
    { key: 'AUTH_THROTTLE_RESET', value: '10/15m' },
    {
      key: 'TRUST_PROXY',
      value: 'false',
      comment: 'true behind a reverse proxy, so client ips come from X-Forwarded-For',
    },
    {
      key: 'JWT_SECRET',
      value: 'change-me-to-at-least-32-characters',
      comment: 'Signs access tokens',
      secret: true,
    },
    { key: 'ACCESS_TOKEN_TTL', value: '15m', comment: 'Durations: <n>s, <n>m, <n>h or <n>d' },
    { key: 'REFRESH_TOKEN_TTL', value: '30d', comment: 'Sliding: each refresh extends it' },
    { key: 'SESSION_ABSOLUTE_TTL', value: '90d', comment: 'No session outlives this' },
    {
      key: 'EMAIL_VERIFICATION_ENABLED',
      value: (options) => String(options.emailVerification),
      comment: 'Require a verified email before login',
    },
    { key: 'EMAIL_VERIFICATION_TTL', value: '24h' },
    { key: 'PASSWORD_RESET_TTL', value: '1h' },
    {
      key: 'SEED_ADMIN_EMAIL',
      value: 'admin@example.com',
      comment: 'The admin user db:seed creates',
    },
    { key: 'SEED_ADMIN_PASSWORD', value: 'change-me', secret: true },
  ],
  compose: {
    services: {
      redis: {
        image: 'redis:8-alpine',
        ports: ['6379:6379'],
        volumes: ['redis-data:/data'],
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '5s',
          timeout: '3s',
          retries: 10,
        },
      },
      mailpit: {
        image: 'axllent/mailpit',
        ports: ['1025:1025', '8025:8025'],
        healthcheck: {
          test: ['CMD', '/mailpit', 'readyz'],
          interval: '5s',
          timeout: '3s',
          retries: 10,
        },
      },
    },
    volumes: ['redis-data'],
  },
  readme: [
    {
      title: 'Project layout',
      body: `
- \`src/main.ts\`, \`src/bootstrap/\`: \`createApp()\` builds the app; \`configureApp()\` applies the HTTP pipeline (security headers, CORS, CSRF, prefix, versioning, validation, Swagger)
- \`src/config/\`: the env schema and the typed \`AppConfig\` accessor
- \`src/common/\`: \`ErrorCode\`, the global exception filter, request validation, pagination
- \`src/modules/\`: users, roles, permissions and sessions: controllers, services and repository ports
- \`src/seed/\`: \`db:seed\`: system roles and the first admin
- \`src/infra/\`: logger, Redis, queues, mail, rate limiting, health checks
- \`src/database/\`: database module and schema
- \`src/auth/\`: authentication and authorization
- \`test/\`: e2e and integration tests, and the harness in \`test/support/\`
`,
    },
    {
      title: 'HTTP conventions',
      body: `
- Routes live under \`/api/v1\`. \`/health\` and \`/docs\` sit outside the prefix.
- Every error body is \`{ statusCode, errorCode, message }\`; \`errorCode\` values are listed in \`src/common/error-code.ts\`. Validation errors add \`details\` with the failing fields: \`[{ field, errors }]\`.
- Every handler declares exactly one of \`@Public()\`, \`@Authenticated()\` or \`@RequirePermissions(...)\` from \`src/auth/decorators.ts\`. A handler with none is refused: 401 for anonymous callers, 403 for signed-in ones.
- Rate limits are per client ip and stored in Redis, so they hold across instances: \`THROTTLE_TTL\` and \`THROTTLE_LIMIT\` for every route, the stricter \`AUTH_THROTTLE_*\` for the routes marked \`@AuthThrottle()\`. Behind a reverse proxy, set \`TRUST_PROXY=true\` so the ip comes from \`X-Forwarded-For\`.
- With \`CSRF_ENABLED=true\`, browsers can't send state-changing requests from other sites. Origins in \`CORS_ORIGINS\` are trusted.
- Every request gets an id from the \`x-request-id\` header, or a generated one, and it appears in every log line.
`,
    },
    {
      title: 'Mail and queues',
      body: `
Mail is never sent inside a request. \`MailQueue.enqueue()\` adds a job to the \`mail\` BullMQ queue and \`MailProcessor\` sends it, with BullMQ handling retries.

- A mail is a \`Mailable\` class in \`src/infra/mail/mailables/\`, registered in \`mail-registry.ts\`, with an HTML template in \`src/infra/mail/templates/\`.
- \`MAIL_TRANSPORT\` picks the transport: \`smtp\` (Mailpit in development, UI at http://localhost:8025), \`resend\` or \`log\`.
- The \`maintenance\` queue runs a daily job that purges expired data: every provider decorated with \`@ExpiredDataPurger()\` (\`src/infra/queue/expired-data-purger.ts\`).
`,
    },
    {
      title: 'Tests',
      body: `
- \`test\` runs unit tests (\`src/**/*.spec.ts\`).
- \`test:e2e\` runs \`test/**/*.e2e-spec.ts\` and \`test/**/*.int-spec.ts\` against real database and Redis containers (Testcontainers; Docker must be running).
- Services are unit-tested against the in-memory repositories in \`test/fakes/\`. The suites in \`test/contracts/\` define how a repository must behave; they run against the fakes and, in \`test:e2e\`, against the real database.
- E2e tests boot the real app with \`createTestApp()\` from \`test/support/app.ts\` and call it over HTTP with \`request()\` from \`test/support/http.ts\`. Sent mail is captured in \`mailbox\`; \`test/support/auth.ts\` seeds users and signs them in.
`,
    },
    {
      title: 'Docker',
      body: `
- \`docker build .\` builds the production image from the \`Dockerfile\`. It runs \`node dist/main.js\` on port 3000 and reads the same env vars as \`.env\`.
- The image installs with the package manager whose lockfile it finds: pnpm, yarn, bun, otherwise npm. Yarn Berry with Plug'n'Play isn't supported: the image copies \`node_modules\`, which Plug'n'Play doesn't write.
`,
    },
  ],
};
