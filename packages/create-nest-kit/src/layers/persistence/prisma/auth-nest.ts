import type { LayerManifest } from '../../types.ts';

/**
 * The stores of `@nestjs/authentication` on Prisma, and this combo's initial migration
 * (`prisma/migrations/`; see `auth-jwt.ts` for why each combo ships its own, and why the
 * `User` and `Session` models live here in `prisma/schema/users.prisma`). Regenerate the
 * migration with `prisma migrate dev --name init` in a generated project whenever a schema
 * file of this combo changes.
 */
export const prismaAuthNestLayer: LayerManifest = {
  id: 'persistence/prisma/auth-nest',
  status: 'ready',
  when: (options) => options.orm === 'prisma' && options.auth === 'nest',
};
