import type { LayerManifest } from '../../types.ts';

/** The jwt auth style's flows, calling the module services. */
export const serviceAuthJwtLayer: LayerManifest = {
  id: 'pattern/service/auth-jwt',
  status: 'ready',
  when: (options) => options.pattern === 'service' && options.auth === 'jwt',
};
