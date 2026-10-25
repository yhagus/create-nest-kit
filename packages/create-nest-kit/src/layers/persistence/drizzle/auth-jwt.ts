import type { LayerManifest } from '../../types.ts';

/**
 * Holds the project's initial migration (`drizzle/`). Drizzle keeps one migration journal per
 * folder, and each auth style needs different tables, so every (drizzle, auth) layer ships its
 * own complete first migration instead of adding to one in `core`. Regenerate it with
 * `drizzle-kit generate` in a generated project whenever a schema file of this combo changes.
 */
export const drizzleAuthJwtLayer: LayerManifest = {
  id: 'persistence/drizzle/auth-jwt',
  status: 'ready',
  when: (options) => options.orm === 'drizzle' && options.auth === 'jwt',
};
