import type { LayerManifest } from '../../types.ts';

/**
 * Entities and repositories for the hand-rolled auth's tokens, plus their migration
 * (`AuthJwtInit`), which runs after `CoreInit` from `persistence/mikroorm/core`.
 */
export const mikroormAuthJwtLayer: LayerManifest = {
  id: 'persistence/mikroorm/auth-jwt',
  status: 'ready',
  when: (options) => options.orm === 'mikroorm' && options.auth === 'jwt',
};
