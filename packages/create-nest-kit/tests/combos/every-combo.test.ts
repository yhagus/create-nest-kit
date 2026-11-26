import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateCombos,
  listCombos,
  mapConcurrently,
  type GeneratedCombo,
} from '../support/combos.ts';
import { unformattedFiles } from '../support/prettier.ts';
import { listFiles } from '../support/project.ts';

// Every ready combo, generated once by the CLI; each test checks one invariant across all of them.

const GENERATE_ALL_TIMEOUT_MS = 180_000;
const CHECK_ALL_TIMEOUT_MS = 180_000;
/** Deleting every generated project (thousands of files) can outlast the 10 s default on slow CI runners. */
const REMOVE_ALL_TIMEOUT_MS = 120_000;

/** A file directly inside `src/auth/` or a feature module's folder, in either layout. */
const FEATURE_MODULE_ROOT_FILE =
  /^src\/(auth|(modules\/)?(users|roles|permissions|sessions))\/[^/]+$/;
const MODULE_OR_CONTROLLER = /\.(module|controller)\.ts$/;
/** The folders the flat layout dissolves. */
const NESTED_ONLY_FOLDER = /^src\/(modules|common|infra)\//;
const SOURCE_FILE = /^(src|tests)\/.*\.ts$/;
/** `from '...'`, `import('...')` and `vi.mock('...')` specifiers. */
const IMPORT_SPECIFIER = /(?:\bfrom\s+|\bimport\(\s*|\bvi\.mock\(\s*)['"]([^'"]+)['"]/g;
/** A package (`zod`, `@nestjs/common`, `node:path`) rather than a file of the project. */
const PACKAGE_SPECIFIER = /^(?:node:|@[\w.-]+\/[\w.-]|[\w])/;

let root = '';
let generated: GeneratedCombo[] = [];

beforeAll(async () => {
  ({ root, generated } = await generateCombos(await listCombos('all')));
}, GENERATE_ALL_TIMEOUT_MS);

afterAll(async () => {
  if (root !== '') await rm(root, { recursive: true, force: true });
}, REMOVE_ALL_TIMEOUT_MS);

function succeeded(choice: { pattern?: string; layout?: string }): GeneratedCombo[] {
  return generated.filter(
    ({ combo, failure }) =>
      failure === undefined &&
      (choice.pattern === undefined || combo.choices.pattern === choice.pattern) &&
      (choice.layout === undefined || combo.choices.layout === choice.layout),
  );
}

/** `<id>: <path>` for each of the combo's files that `isViolation` flags. */
async function violatingFiles(
  { combo, projectDir }: GeneratedCombo,
  isViolation: (file: string) => boolean,
): Promise<string[]> {
  return (await listFiles(projectDir)).filter(isViolation).map((file) => `${combo.id}: ${file}`);
}

/** The module of a project file, as the `@/` rule sees it: `src/<folder>`, `tests`, or the file. */
function moduleOf(projectFilePath: string): string {
  const [rootFolder, folder, ...rest] = projectFilePath.split('/');
  if (rootFolder === 'tests') return 'tests';
  return rest.length > 0 ? `${rootFolder}/${folder}` : projectFilePath;
}

/**
 * True when an import breaks the `@/` rule: relative across modules, aliased within one, or
 * through any other alias.
 */
function breaksAliasRule(importingFile: string, specifier: string): boolean {
  const isAliased = specifier.startsWith('@/');
  const isRelative = specifier.startsWith('.');
  if (!isAliased && !isRelative) return !PACKAGE_SPECIFIER.test(specifier);
  const importedPath = isAliased
    ? `src/${specifier.slice(2)}`
    : path.posix.join(path.posix.dirname(importingFile), specifier);
  const isSameModule = moduleOf(importedPath) === moduleOf(importingFile);
  return isAliased === isSameModule;
}

async function flatImportViolations({ combo, projectDir }: GeneratedCombo): Promise<string[]> {
  const sourceFiles = (await listFiles(projectDir)).filter((file) => SOURCE_FILE.test(file));
  const violations = await Promise.all(
    sourceFiles.map(async (file) => {
      const content = await readFile(path.join(projectDir, file), 'utf8');
      return [...content.matchAll(IMPORT_SPECIFIER)]
        .map(([, specifier = '']) => specifier)
        .filter((specifier) => breaksAliasRule(file, specifier))
        .map((specifier) => `${combo.id}: ${file} imports ${specifier}`);
    }),
  );
  return violations.flat();
}

describe('every ready combo', () => {
  it('is generated', () => {
    const failures = generated
      .filter(({ failure }) => failure !== undefined)
      .map(({ combo, failure }) => `${combo.id}: ${failure}`);

    expect(failures).toEqual([]);
    expect(generated.length).toBeGreaterThan(0);
  });

  it(
    'with CQRS keeps only modules and controllers at the root of each feature module',
    async () => {
      const loose = await Promise.all(
        succeeded({ pattern: 'cqrs' }).map((project) =>
          violatingFiles(
            project,
            (file) => FEATURE_MODULE_ROOT_FILE.test(file) && !MODULE_OR_CONTROLLER.test(file),
          ),
        ),
      );

      expect(loose.flat()).toEqual([]);
    },
    CHECK_ALL_TIMEOUT_MS,
  );

  it(
    'with the flat layout leaves nothing under src/modules, src/common or src/infra',
    async () => {
      const nested = await Promise.all(
        succeeded({ layout: 'flat' }).map((project) =>
          violatingFiles(project, (file) => NESTED_ONLY_FOLDER.test(file)),
        ),
      );

      expect(nested.flat()).toEqual([]);
    },
    CHECK_ALL_TIMEOUT_MS,
  );

  it(
    'with the flat layout imports across modules through @/ and within a module relatively',
    async () => {
      const violations = await Promise.all(succeeded({ layout: 'flat' }).map(flatImportViolations));

      expect(violations.flat()).toEqual([]);
    },
    CHECK_ALL_TIMEOUT_MS,
  );

  it(
    'passes prettier --check',
    async () => {
      const unformatted = await mapConcurrently(succeeded({}), async ({ combo, projectDir }) =>
        (await unformattedFiles(projectDir)).map((file) => `${combo.id}: ${file}`),
      );

      expect(unformatted.flat()).toEqual([]);
    },
    CHECK_ALL_TIMEOUT_MS,
  );
});
