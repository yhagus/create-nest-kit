import type { LayerManifest } from '../types.ts';

export const nestAuthLayer: LayerManifest = {
  id: 'auth/nest',
  status: 'ready',
  when: (options) => options.auth === 'nest',
  dependencies: {
    // Pre-1.0: pinned exactly, and checked by the matrix on every change.
    '@nestjs/authentication': '0.1.1',
    '@nestjs/authorization': '0.1.0',
  },
  readme: [
    {
      title: 'Authentication (@nestjs/authentication + @nestjs/authorization)',
      body: `
- \`src/auth/nest-auth.service.ts\` implements the \`AuthService\` port behind \`/auth\` with the official packages: \`TokenService\` issues and rotates tokens, \`PasswordResetService\` and \`EmailVerificationService\` run the mailed links. Passwords are hashed with scrypt (\`PasswordHasher\` from \`@nestjs/authentication\`).
- Access tokens are JWTs carrying the user (\`sub\`) and the device session (\`sid\`), valid for \`ACCESS_TOKEN_TTL\`. \`AccessTokenProvider\` checks them on every route that is not \`@Public()\`, including the Redis deny-list of revoked sessions.
- Refresh tokens are opaque and single use; each refresh rotates them, and presenting a rotated one revokes the session. Each token row records its session (\`auth_refresh_tokens.session_id\`), so revoking a session revokes its tokens.
- Device sessions live in \`sessions\`, as in every auth style. The package's own cookie-session table (\`auth_sessions\`) stays empty: password reset needs it to exist.
- Authorization is deny by default (\`@nestjs/authorization\`): \`@Authenticated()\` is \`@Can.Anyone()\`, and \`@RequirePermissions(...)\` is \`@Can(PermissionPolicy, 'has', ...)\` (\`src/auth/permission.policy.ts\`).
- The stores are registered in \`src/database/auth-persistence.module.ts\`; \`test/contracts/\` holds their spec.
`,
    },
  ],
};
