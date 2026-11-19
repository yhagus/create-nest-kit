import { projectPath } from '../../generate/relocate.ts';
import type { Pattern, ProjectOptions } from '../../options.ts';
import type { LayerManifest } from '../types.ts';

/** Where the `/auth` flows live, in each application pattern. */
const FLOWS_BY_PATTERN: Record<Pattern, (options: ProjectOptions) => string> = {
  service: () => '`src/auth/jwt-auth.service.ts` implements the `AuthService` port behind `/auth`.',
  cqrs: (options) =>
    `The \`/auth\` commands live in \`src/auth/commands/impl/\` and their handlers in \`src/auth/commands/handlers/\`; \`${projectPath('src/auth/session-tokens.ts', options)}\` starts and refreshes sessions for the login and refresh handlers.`,
};

export const jwtAuthLayer: LayerManifest = {
  id: 'auth/jwt',
  status: 'ready',
  when: (options) => options.auth === 'jwt',
  dependencies: {
    '@nestjs/jwt': '12.0.3',
    // Prebuilt binaries: installs without a build script (unlike `argon2`).
    '@node-rs/argon2': '2.2.2',
  },
  readme: [
    {
      title: 'Authentication (hand-rolled)',
      body: (options) => `
- ${FLOWS_BY_PATTERN[options.pattern](options)} Passwords are hashed with argon2id.
- Access tokens are HS256 JWTs carrying the user (\`sub\`) and the session (\`sid\`), valid for \`ACCESS_TOKEN_TTL\`. \`JwtAuthGuard\` checks them on every route that needs a user, including the Redis deny-list of revoked sessions; \`PermissionsGuard\` then checks the route's access decorator.
- A refresh token is \`<session id>.<secret>\`; only the secret's SHA-256 is stored (\`session_refresh_tokens\`). Each refresh replaces it in one compare-and-set, and presenting a replaced token revokes the session.
- Email-verification and password-reset tokens are single-use and stored hashed (\`verification_tokens\`); issuing one invalidates the user's earlier one of the same kind.
- The storage ports (\`RefreshTokensRepository\`, \`VerificationTokensRepository\`) are bound in \`src/database/auth-persistence.module.ts\`.
`,
    },
  ],
};
