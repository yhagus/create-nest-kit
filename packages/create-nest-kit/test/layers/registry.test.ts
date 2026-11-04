import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mergeManifests } from '../../src/layers/merge.ts';
import { LAYERS } from '../../src/layers/registry.ts';
import { resolveLayers } from '../../src/layers/resolve.ts';
import { DATABASES, listCombos, optionsForCombo, parseProjectOptions } from '../../src/options.ts';
import { TEMPLATES_DIR } from '../../src/paths.ts';

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('built-in layers', () => {
  it.each(listCombos())('resolves the layers of $id in composition order', (combo) => {
    const ids = resolveLayers(optionsForCombo(combo), LAYERS).map((layer) => layer.id);

    expect(ids).toEqual([
      'base',
      `platform/${combo.platform}`,
      `database/${combo.database}`,
      `validation/${combo.validation}`,
      `pattern/${combo.pattern}/core`,
      `persistence/${combo.orm}/core`,
      `persistence/${combo.orm}/auth-${combo.auth}`,
      `auth/${combo.auth}`,
      `pattern/${combo.pattern}/auth-${combo.auth}`,
    ]);
  });

  it('pins every dependency to an exact version', () => {
    const pins = LAYERS.flatMap((layer) =>
      Object.entries({ ...layer.dependencies, ...layer.devDependencies }).map(
        ([name, version]) => `${layer.id}: ${name}@${version}`,
      ),
    );
    const rangePins = pins.filter(
      (pin) => !EXACT_VERSION.test(pin.slice(pin.lastIndexOf('@') + 1)),
    );

    expect(rangePins).toEqual([]);
  });

  it("pins every dependency of the front end's own package.json to an exact version", async () => {
    const dependencies = z.record(z.string(), z.string());
    const packageJson = z
      .object({ dependencies, devDependencies: dependencies })
      .parse(
        JSON.parse(await readFile(path.join(TEMPLATES_DIR, 'web/nuxt/web/package.json'), 'utf8')),
      );
    const pins = Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies });

    expect(pins.filter(([, version]) => !EXACT_VERSION.test(version))).toEqual([]);
  });

  it.each(DATABASES)(
    'points every container value at a compose service of the %s project',
    (database) => {
      const options = parseProjectOptions({ name: 'api', directory: 'api', database });
      const manifest = mergeManifests(resolveLayers(options, LAYERS), options);
      const containerHosts = manifest.envGroups
        .flatMap(({ vars }) => vars)
        .flatMap(({ containerValue }) =>
          containerValue === undefined ? [] : [new URL(containerValue).hostname],
        );

      expect(containerHosts.length).toBeGreaterThan(0);
      expect(Object.keys(manifest.composeServices)).toEqual(expect.arrayContaining(containerHosts));
    },
  );
});
