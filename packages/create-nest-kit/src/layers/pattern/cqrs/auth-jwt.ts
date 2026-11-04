import type { LayerManifest } from '../../types.ts';

/** The jwt auth style's flows as command handlers. */
export const cqrsAuthJwtLayer: LayerManifest = {
  id: 'pattern/cqrs/auth-jwt',
  status: 'ready',
  when: (options) => options.pattern === 'cqrs' && options.auth === 'jwt',
};
