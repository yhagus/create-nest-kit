import { describe, expect, it } from 'vitest';
import { composeProject } from '../../src/generate/compose.ts';
import { BUILT_IN_LAYER_SET } from '../../src/layers/registry.ts';
import { isComboReady } from '../../src/layers/resolve.ts';
import {
  listCombos,
  optionsForCombo,
  parseProjectOptions,
  type Combo,
  type ProjectType,
} from '../../src/options.ts';

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

/** The template files under `web/` of a project of this type. */
async function webFiles(projectType: ProjectType) {
  const options = parseProjectOptions({ name: 'app', directory: 'app', projectType });
  const plan = await composeProject(options, BUILT_IN_LAYER_SET);
  return plan.templateFiles.filter((file) => file.target.startsWith('web/'));
}

describe('built-in layer coverage', () => {
  // Combos with a planned layer are skipped; each one is covered as soon as its layers are ready.
  it('composes every combo whose layers are all ready, without collisions, conflicts or unfilled slots', async () => {
    const readyCombos = listCombos().filter((combo) =>
      isComboReady(combo, BUILT_IN_LAYER_SET.layers),
    );

    expect(await compositionFailures(readyCombos)).toEqual([]);
  });

  it('adds the front end to an API + web project, and only there', async () => {
    expect(await webFiles('api')).toEqual([]);
    expect((await webFiles('fullstack')).map((file) => file.target)).toEqual(
      expect.arrayContaining(['web/package.json', 'web/nuxt.config.ts', 'web/.gitignore']),
    );
  });
});
