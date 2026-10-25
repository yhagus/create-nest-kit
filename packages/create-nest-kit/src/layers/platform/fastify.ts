import { NEST_VERSION } from '../base.ts';
import type { LayerManifest } from '../types.ts';

export const fastifyLayer: LayerManifest = {
  id: 'platform/fastify',
  status: 'ready',
  when: (options) => options.platform === 'fastify',
  dependencies: {
    '@fastify/static': '10.1.7',
    '@nestjs/platform-fastify': NEST_VERSION,
  },
};
