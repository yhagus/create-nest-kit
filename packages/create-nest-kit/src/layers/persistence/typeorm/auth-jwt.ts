import type { LayerManifest } from '../../types.ts';

/**
 * Entities and repositories for the hand-rolled auth's tokens, plus their migration
 * (`AuthJwtInit`), which runs after `CoreInit` from `persistence/typeorm/core`.
 */
export const typeormAuthJwtLayer: LayerManifest = {
  id: 'persistence/typeorm/auth-jwt',
  status: 'ready',
  when: (options) => options.orm === 'typeorm' && options.auth === 'jwt',
};
