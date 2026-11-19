import type { LayerManifest } from '../types.ts';

/**
 * Every module a top-level folder of `src/`, shared code in `src/libs/` (see `flatLayout` in
 * src/generate/relocate.ts). Provides the configs that declare and resolve the `@/` alias the
 * imports across modules use.
 */
export const flatLayoutLayer: LayerManifest = {
  id: 'layout/flat',
  status: 'ready',
  when: (options) => options.layout === 'flat',
};
