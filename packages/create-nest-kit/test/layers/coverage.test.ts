import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeProject, listTemplateFiles } from '../../src/generate/compose.ts';
import { BUILT_IN_LAYER_SET } from '../../src/layers/registry.ts';
import { isComboReady, resolveLayers } from '../../src/layers/resolve.ts';
import {
  listCombos,
  optionsForCombo,
  parseProjectOptions,
  type Combo,
  type Layout,
  type Pattern,
  type ProjectType,
} from '../../src/options.ts';

/** Composing every combo takes longer than vitest's 5s default, and grows with each new choice. */
const ALL_COMBOS_TIMEOUT_MS = 30_000;

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

/** A file directly inside `src/auth/` or a feature module's folder, in either layout. */
const FEATURE_MODULE_ROOT_FILE =
  /^src\/(auth|(modules\/)?(users|roles|permissions|sessions))\/[^/]+$/;
const MODULE_OR_CONTROLLER = /\.(module|controller)\.ts$/;

function readyCombosOf(choices: { pattern?: Pattern; layout?: Layout }): Combo[] {
  return listCombos().filter(
    (combo) =>
      (choices.pattern === undefined || combo.pattern === choices.pattern) &&
      (choices.layout === undefined || combo.layout === choices.layout) &&
      isComboReady(combo, BUILT_IN_LAYER_SET.layers),
  );
}

/** The folders the flat layout dissolves. */
const NESTED_ONLY_FOLDER = /^src\/(modules|common|infra)\//;

/** `from '...'` and `import('...')` specifiers, relative or aliased. */
const IMPORT_SPECIFIER =
  /(?:\bfrom\s+|\bimport\(\s*|\bvi\.mock\(\s*)['"]((?:\.{1,2}|@)\/[^'"]+)['"]/g;

/** The module of a project file, as the `@/` rule sees it: `src/<folder>`, `test`, or the file. */
function moduleOf(projectFilePath: string): string {
  const [root, folder, ...rest] = projectFilePath.split('/');
  if (root === 'test') return 'test';
  return rest.length > 0 ? `${root}/${folder}` : projectFilePath;
}

/**
 * `<id>: <file> imports <specifier>` for every import of a flat project that breaks the `@/`
 * rule: a relative import that leaves its module, or an aliased one that stays inside it.
 */
async function flatImportViolations(combo: Combo): Promise<string[]> {
  const plan = await composeProject(optionsForCombo(combo), BUILT_IN_LAYER_SET);
  const sourceFiles = plan.templateFiles.filter((file) => /^(src|test)\/.*\.ts$/.test(file.target));
  const violations = await Promise.all(
    sourceFiles.map(async (file) => {
      const content = file.content ?? (await readFile(file.source, 'utf8'));
      return [...content.matchAll(IMPORT_SPECIFIER)]
        .map(([, specifier = '']) => specifier)
        .filter((specifier) => {
          const isAliased = specifier.startsWith('@/');
          const importedPath = isAliased
            ? `src/${specifier.slice(2)}`
            : path.posix.join(path.posix.dirname(file.target), specifier);
          const isSameModule = moduleOf(importedPath) === moduleOf(file.target);
          return isAliased === isSameModule;
        })
        .map((specifier) => `${combo.id}: ${file.target} imports ${specifier}`);
    }),
  );
  return violations.flat();
}

/** `<id>: <path>` for every file other than a module or controller at a feature-module root. */
async function looseFeatureModuleFiles(combo: Combo): Promise<string[]> {
  const plan = await composeProject(optionsForCombo(combo), BUILT_IN_LAYER_SET);
  return plan.templateFiles
    .map((file) => file.target)
    .filter((target) => FEATURE_MODULE_ROOT_FILE.test(target) && !MODULE_OR_CONTROLLER.test(target))
    .map((target) => `${combo.id}: ${target}`);
}

/** `<id>: <path>` for every planned file whose path or content differs from its template. */
async function relocatedFiles(combo: Combo): Promise<string[]> {
  const options = optionsForCombo(combo);
  const plan = await composeProject(options, BUILT_IN_LAYER_SET);
  const layerFiles = await Promise.all(
    resolveLayers(options, BUILT_IN_LAYER_SET.layers).map((layer) =>
      listTemplateFiles(layer.id, BUILT_IN_LAYER_SET.templatesDir),
    ),
  );
  const templateTargets = new Set(layerFiles.flat().map((file) => file.target));
  return plan.templateFiles
    .filter((file) => !templateTargets.has(file.target) || file.content !== undefined)
    .map((file) => `${combo.id}: ${file.target}`);
}

/** The template files under `web/` of a project of this type. */
async function webFiles(projectType: ProjectType) {
  const options = parseProjectOptions({ name: 'app', directory: 'app', projectType });
  const plan = await composeProject(options, BUILT_IN_LAYER_SET);
  return plan.templateFiles.filter((file) => file.target.startsWith('web/'));
}

describe('built-in layer coverage', () => {
  // Combos with a planned layer are skipped; each one is covered as soon as its layers are ready.
  it(
    'composes every combo whose layers are all ready, without collisions, conflicts or unfilled slots',
    async () => {
      const readyCombos = listCombos().filter((combo) =>
        isComboReady(combo, BUILT_IN_LAYER_SET.layers),
      );

      expect(await compositionFailures(readyCombos)).toEqual([]);
    },
    ALL_COMBOS_TIMEOUT_MS,
  );

  it(
    'keeps only modules and controllers at the root of every feature module of a CQRS project',
    async () => {
      const loose = await Promise.all(
        readyCombosOf({ pattern: 'cqrs' }).map(looseFeatureModuleFiles),
      );

      expect(loose.flat()).toEqual([]);
    },
    ALL_COMBOS_TIMEOUT_MS,
  );

  it(
    'copies the templates of a nested service project unchanged, at their own paths',
    async () => {
      const relocated = await Promise.all(
        readyCombosOf({ pattern: 'service', layout: 'nested' }).map(relocatedFiles),
      );

      expect(relocated.flat()).toEqual([]);
    },
    ALL_COMBOS_TIMEOUT_MS,
  );

  it(
    'leaves nothing under src/modules/, src/common/ or src/infra/ in a flat project',
    async () => {
      const plans = await Promise.all(
        readyCombosOf({ layout: 'flat' }).map(async (combo) => ({
          combo,
          plan: await composeProject(optionsForCombo(combo), BUILT_IN_LAYER_SET),
        })),
      );
      const nestedFiles = plans.flatMap(({ combo, plan }) =>
        plan.templateFiles
          .filter((file) => NESTED_ONLY_FOLDER.test(file.target))
          .map((file) => `${combo.id}: ${file.target}`),
      );

      expect(nestedFiles).toEqual([]);
    },
    ALL_COMBOS_TIMEOUT_MS,
  );

  it(
    'imports across modules through @/ and within a module relatively, in every flat project',
    async () => {
      const violations = await Promise.all(
        readyCombosOf({ layout: 'flat' }).map(flatImportViolations),
      );

      expect(violations.flat()).toEqual([]);
    },
    ALL_COMBOS_TIMEOUT_MS,
  );

  it('adds the front end to an API + web project, and only there', async () => {
    expect(await webFiles('api')).toEqual([]);
    expect((await webFiles('fullstack')).map((file) => file.target)).toEqual(
      expect.arrayContaining(['web/package.json', 'web/nuxt.config.ts', 'web/.gitignore']),
    );
  });
});
