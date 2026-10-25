import { describe, expect, it } from 'vitest';
import { composeProject } from '../../src/generate/compose.ts';
import { BUILT_IN_LAYER_SET } from '../../src/layers/registry.ts';
import { isComboReady } from '../../src/layers/resolve.ts';
import { listCombos, optionsForCombo, type Combo } from '../../src/options.ts';

/** Composes each combo and returns `<id>: <error>` for every one that fails. */
async function compositionFailures(combos: readonly Combo[]): Promise<string[]> {
  const results = await Promise.all(
    combos.map((combo) =>
      composeProject(optionsForCombo(combo), BUILT_IN_LAYER_SET).then(
        () => undefined,
        (error: unknown) => `${combo.id}: ${String(error)}`,
      ),
    ),
  );
  return results.filter((failure) => failure !== undefined);
}

describe('built-in layer coverage', () => {
  // Combos with a planned layer are skipped; each one is covered as soon as its layers are ready.
  it('composes every combo whose layers are all ready, without collisions, conflicts or unfilled slots', async () => {
    const readyCombos = listCombos().filter((combo) =>
      isComboReady(combo, BUILT_IN_LAYER_SET.layers),
    );

    expect(await compositionFailures(readyCombos)).toEqual([]);
  });
});
