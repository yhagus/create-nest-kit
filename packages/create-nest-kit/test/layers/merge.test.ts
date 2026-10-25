import { describe, expect, it } from 'vitest';
import { ManifestConflictError, mergeManifests } from '../../src/layers/merge.ts';
import type { LayerManifest } from '../../src/layers/types.ts';
import { parseProjectOptions } from '../../src/options.ts';

const options = parseProjectOptions({ name: 'api', directory: 'api' });

function layer(id: string, manifest: Partial<LayerManifest>): LayerManifest {
  return { id, status: 'ready', when: () => true, ...manifest };
}

describe('mergeManifests', () => {
  it('rejects one dependency pinned to two versions, naming both layers', () => {
    const layers = [
      layer('base', { dependencies: { pg: '8.23.1' } }),
      layer('database/postgres', { dependencies: { pg: '8.20.0' } }),
    ];

    expect(() => mergeManifests(layers, options)).toThrow(
      'dependency "pg": base sets "8.23.1", database/postgres sets "8.20.0"',
    );
  });

  it('accepts the same dependency at the same version from two layers', () => {
    const layers = [
      layer('base', { dependencies: { pg: '8.23.1' } }),
      layer('database/postgres', { dependencies: { pg: '8.23.1' } }),
    ];

    expect(mergeManifests(layers, options).dependencies).toEqual({ pg: '8.23.1' });
  });

  it('rejects one script defined differently by two layers', () => {
    const layers = [
      layer('a', { scripts: { 'db:migrate': 'drizzle-kit migrate' } }),
      layer('b', { scripts: { 'db:migrate': 'prisma migrate deploy' } }),
    ];

    expect(() => mergeManifests(layers, options)).toThrow(ManifestConflictError);
  });

  it('rejects one env var declared differently by two layers', () => {
    const layers = [
      layer('a', { env: [{ key: 'PORT', value: '3000' }] }),
      layer('b', { env: [{ key: 'PORT', value: '4000' }] }),
    ];

    expect(() => mergeManifests(layers, options)).toThrow('env var "PORT"');
  });

  it('keeps an env var repeated with the same value in the first layer only', () => {
    const layers = [
      layer('a', { env: [{ key: 'PORT', value: '3000' }] }),
      layer('b', {
        env: [
          { key: 'PORT', value: '3000' },
          { key: 'HOST', value: '0.0.0.0' },
        ],
      }),
    ];

    expect(mergeManifests(layers, options).envGroups).toEqual([
      { layerId: 'a', vars: [{ key: 'PORT', value: '3000', isSecret: false }] },
      { layerId: 'b', vars: [{ key: 'HOST', value: '0.0.0.0', isSecret: false }] },
    ]);
  });

  it('resolves option-dependent env values and readme bodies', () => {
    const merged = mergeManifests(
      [
        layer('a', {
          env: [{ key: 'CSRF_ENABLED', value: (o) => String(o.csrf) }],
          readme: [{ title: 'Auth', body: (o) => `Style: ${o.auth}` }],
        }),
      ],
      options,
    );

    expect(merged.envGroups[0]?.vars[0]?.value).toBe('true');
    expect(merged.readmeSections).toEqual([{ layerId: 'a', title: 'Auth', body: 'Style: jwt' }]);
  });

  it('deep-merges packageJson fields and unions arrays', () => {
    const layers = [
      layer('a', { packageJson: { pnpm: { onlyBuiltDependencies: ['argon2'] } } }),
      layer('b', {
        packageJson: {
          pnpm: { onlyBuiltDependencies: ['argon2', 'prisma'] },
          prisma: { seed: 'x' },
        },
      }),
    ];

    expect(mergeManifests(layers, options).packageJson).toEqual({
      pnpm: { onlyBuiltDependencies: ['argon2', 'prisma'] },
      prisma: { seed: 'x' },
    });
  });

  it('rejects conflicting packageJson leaf values', () => {
    const layers = [
      layer('a', { packageJson: { prisma: { schema: 'a.prisma' } } }),
      layer('b', { packageJson: { prisma: { schema: 'b.prisma' } } }),
    ];

    expect(() => mergeManifests(layers, options)).toThrow('package.json field "prisma.schema"');
  });

  it('rejects packageJson fields the renderer owns', () => {
    const layers = [layer('a', { packageJson: { scripts: { dev: 'x' } } })];

    expect(() => mergeManifests(layers, options)).toThrow('package.json field "scripts" in a');
  });
});
