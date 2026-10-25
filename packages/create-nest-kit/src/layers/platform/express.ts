import { NEST_VERSION } from '../base.ts';
import type { LayerManifest } from '../types.ts';

export const expressLayer: LayerManifest = {
  id: 'platform/express',
  status: 'ready',
  when: (options) => options.platform === 'express',
  dependencies: {
    '@nestjs/platform-express': NEST_VERSION,
  },
  devDependencies: {
    '@types/express': '5.0.6',
  },
};
