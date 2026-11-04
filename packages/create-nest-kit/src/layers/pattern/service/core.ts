import type { LayerManifest } from '../../types.ts';

/** Controllers call services, which hold the logic and the calls between modules. */
export const serviceCoreLayer: LayerManifest = {
  id: 'pattern/service/core',
  status: 'ready',
  when: (options) => options.pattern === 'service',
};
