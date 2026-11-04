import type { LayerManifest } from '../../types.ts';

/** The nest auth style's flows, calling the module services. */
export const serviceAuthNestLayer: LayerManifest = {
  id: 'pattern/service/auth-nest',
  status: 'ready',
  when: (options) => options.pattern === 'service' && options.auth === 'nest',
};
