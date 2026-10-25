import { describe, expect, it } from 'vitest';
import type { LayerManifest } from '../../src/layers/types.ts';
import { parseMatrixArgs, partitionByReadiness, selectCombos } from '../../src/matrix/select.ts';
import { comboId, type Combo, type Platform } from '../../src/options.ts';

function comboWith(platform: Platform): Combo {
  const combo = {
    platform,
    database: 'postgres',
    orm: 'drizzle',
    auth: 'jwt',
    validation: 'class-validator',
  } as const;
  return { ...combo, id: comboId(combo) };
}

describe('parseMatrixArgs', () => {
  it('defaults to every combo and every step', () => {
    expect(parseMatrixArgs([])).toEqual({
      only: undefined,
      subset: 'all',
      steps: ['install', 'typecheck', 'build', 'lint', 'format:check', 'test', 'test:e2e'],
      keep: false,
      list: false,
    });
  });

  it('reads --list, which prints the selected combo ids instead of running them', () => {
    expect(parseMatrixArgs(['--list', '--subset', 'pr'])).toMatchObject({
      subset: 'pr',
      list: true,
    });
  });

  it('reads a step list', () => {
    expect(parseMatrixArgs(['--steps', 'install, typecheck']).steps).toEqual([
      'install',
      'typecheck',
    ]);
  });

  it('rejects an unknown step', () => {
    expect(() => parseMatrixArgs(['--steps', 'install,deploy'])).toThrow(
      '--steps must be one of install, typecheck, build, lint, format:check, test, test:e2e (got "deploy")',
    );
  });
});

describe('selectCombos', () => {
  it('filters by a glob on the combo id', () => {
    const ids = selectCombos({ subset: 'all', only: 'express-*-nest-valibot' }).map((c) => c.id);

    expect(ids).toEqual([
      'express-postgres-drizzle-nest-valibot',
      'express-postgres-prisma-nest-valibot',
      'express-postgres-typeorm-nest-valibot',
      'express-postgres-mikroorm-nest-valibot',
      'express-mongodb-mongoose-nest-valibot',
    ]);
  });

  it('applies the glob within the PR subset', () => {
    expect(selectCombos({ subset: 'pr', only: '*-mongoose-*' })).toHaveLength(4);
  });
});

describe('partitionByReadiness', () => {
  it('skips combos with a planned layer and says which', () => {
    const layers: LayerManifest[] = [
      { id: 'base', status: 'ready', when: () => true },
      { id: 'platform/express', status: 'planned', when: (o) => o.platform === 'express' },
    ];
    const fastifyCombo = comboWith('fastify');
    const expressCombo = comboWith('express');

    const result = partitionByReadiness([fastifyCombo, expressCombo], layers);

    expect(result.ready).toEqual([fastifyCombo]);
    expect(result.skipped).toEqual([
      { combo: expressCombo, plannedLayerIds: ['platform/express'] },
    ]);
  });
});
