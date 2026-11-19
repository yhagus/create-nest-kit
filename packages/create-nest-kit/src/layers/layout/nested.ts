import type { LayerManifest } from '../types.ts';

/**
 * The templates' own layout: modules under `src/modules/`, shared code in `src/common/`,
 * infrastructure in `src/infra/`, relative imports. Provides the configs that name those paths.
 */
export const nestedLayoutLayer: LayerManifest = {
  id: 'layout/nested',
  status: 'ready',
  when: (options) => options.layout === 'nested',
};
