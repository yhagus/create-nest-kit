import { NEST_VERSION } from '../base.ts';
import type { LayerManifest } from '../types.ts';

export const nodeLayer: LayerManifest = {
  id: 'platform/node',
  status: 'ready',
  when: (options) => options.platform === 'node',
  dependencies: {
    '@nestjs/platform-node': NEST_VERSION,
  },
};
