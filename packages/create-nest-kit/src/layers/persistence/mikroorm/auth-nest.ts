import type { LayerManifest } from '../../types.ts';

/**
 * The stores of `@nestjs/authentication` on MikroORM, plus their migration (`AuthNestInit`),
 * which runs after `CoreInit` from `persistence/mikroorm/core`.
 */
export const mikroormAuthNestLayer: LayerManifest = {
  id: 'persistence/mikroorm/auth-nest',
  status: 'ready',
  when: (options) => options.orm === 'mikroorm' && options.auth === 'nest',
};
