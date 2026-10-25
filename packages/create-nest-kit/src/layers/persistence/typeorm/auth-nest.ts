import type { LayerManifest } from '../../types.ts';

/**
 * Entities and the store of `@nestjs/authentication` on TypeORM, plus their migration
 * (`AuthNestInit`), which runs after `CoreInit` from `persistence/typeorm/core`.
 */
export const typeormAuthNestLayer: LayerManifest = {
  id: 'persistence/typeorm/auth-nest',
  status: 'ready',
  when: (options) => options.orm === 'typeorm' && options.auth === 'nest',
};
