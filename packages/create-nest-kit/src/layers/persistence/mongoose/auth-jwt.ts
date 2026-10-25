import type { LayerManifest } from '../../types.ts';

/**
 * Schemas and repositories for the hand-rolled auth's tokens. Their indexes are created by
 * `db:migrate` from `persistence/mongoose/core`, which syncs every file in `src/database/schemas/`.
 */
export const mongooseAuthJwtLayer: LayerManifest = {
  id: 'persistence/mongoose/auth-jwt',
  status: 'ready',
  when: (options) => options.orm === 'mongoose' && options.auth === 'jwt',
};
