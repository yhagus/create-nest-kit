import { describe, expect, it } from 'vitest';
import { LAYERS } from '../../src/layers/registry.ts';
import { resolveLayers } from '../../src/layers/resolve.ts';
import { listCombos, optionsForCombo } from '../../src/options.ts';

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe('built-in layers', () => {
  it.each(listCombos())('resolves the layers of $id in composition order', (combo) => {
    const ids = resolveLayers(optionsForCombo(combo), LAYERS).map((layer) => layer.id);

    expect(ids).toEqual([
      'base',
      `platform/${combo.platform}`,
      `database/${combo.database}`,
      `validation/${combo.validation}`,
      `persistence/${combo.orm}/core`,
      `persistence/${combo.orm}/auth-${combo.auth}`,
      `auth/${combo.auth}`,
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
});
