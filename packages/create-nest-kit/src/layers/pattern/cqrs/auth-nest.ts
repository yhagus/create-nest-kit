import type { LayerManifest } from '../../types.ts';

/** The nest auth style's flows as command handlers. */
export const cqrsAuthNestLayer: LayerManifest = {
  id: 'pattern/cqrs/auth-nest',
  status: 'ready',
  when: (options) => options.pattern === 'cqrs' && options.auth === 'nest',
};
