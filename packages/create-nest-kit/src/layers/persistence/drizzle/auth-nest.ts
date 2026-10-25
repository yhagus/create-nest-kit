import type { LayerManifest } from '../../types.ts';

/**
 * The stores of `@nestjs/authentication` on Drizzle, and this combo's initial migration
 * (`drizzle/`; see `auth-jwt.ts` for why each combo ships its own). Regenerate it with
 * `drizzle-kit generate` in a generated project whenever a schema file of this combo changes.
 */
export const drizzleAuthNestLayer: LayerManifest = {
  id: 'persistence/drizzle/auth-nest',
  status: 'ready',
  when: (options) => options.orm === 'drizzle' && options.auth === 'nest',
};
