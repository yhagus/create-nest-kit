import type { LayerManifest } from '../../types.ts';

/**
 * Holds the project's initial migration (`prisma/migrations/`). Prisma keeps one migration
 * history per project, and each auth style needs different tables, so every (prisma, auth)
 * layer ships its own complete first migration instead of adding to one in `core`.
 *
 * It also holds the `User` and `Session` models (`prisma/schema/users.prisma`): Prisma needs
 * both sides of every relation, and this style's tables reference users and sessions.
 * Regenerate the migration with `prisma migrate dev --name init` in a generated project
 * whenever a schema file of this combo changes.
 */
export const prismaAuthJwtLayer: LayerManifest = {
  id: 'persistence/prisma/auth-jwt',
  status: 'ready',
  when: (options) => options.orm === 'prisma' && options.auth === 'jwt',
};
