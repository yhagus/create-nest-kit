import type { LayerManifest } from '../../types.ts';

/**
 * Schemas and the store of `@nestjs/authentication` on Mongoose. Their indexes are created by
 * `db:migrate` from `persistence/mongoose/core`, which syncs every file in `src/database/schemas/`.
 */
export const mongooseAuthNestLayer: LayerManifest = {
  id: 'persistence/mongoose/auth-nest',
  status: 'ready',
  when: (options) => options.orm === 'mongoose' && options.auth === 'nest',
};
