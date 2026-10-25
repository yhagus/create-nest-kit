import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import { composeProject, listTemplateFiles } from '../../src/generate/compose.ts';
import { BUILT_IN_LAYER_SET } from '../../src/layers/registry.ts';
import { isComboReady } from '../../src/layers/resolve.ts';
import { listCombos, optionsForCombo } from '../../src/options.ts';

// Generated projects run `prettier --check .` (format:check). These tests apply the same config
// and ignore files to the templates and the rendered files, so `pnpm test` catches a formatting
// regression without generating and installing a project.

const BASE_TEMPLATE_DIR = path.join(BUILT_IN_LAYER_SET.templatesDir, 'base');
const PROJECT_CONFIG_PATH = path.join(BASE_TEMPLATE_DIR, '_prettierrc');
// Prettier's CLI reads both from the project root by default.
const PROJECT_IGNORE_PATHS = ['_gitignore', '_prettierignore'].map((name) =>
  path.join(BASE_TEMPLATE_DIR, name),
);
const REPO_CONFIG_PATH = fileURLToPath(new URL('../../../../.prettierrc', import.meta.url));

interface ProjectFile {
  /** Path inside the generated project. */
  target: string;
  content: string;
}

async function loadConfig(configPath: string): Promise<prettier.Options | null> {
  // The path of the file being formatted doesn't matter: `config` points at the file to load.
  return prettier.resolveConfig(configPath, { config: configPath, editorconfig: false });
}

/** The files that `prettier --check .` would flag in a generated project. */
async function unformattedFiles<T extends ProjectFile>(files: readonly T[]): Promise<T[]> {
  const config = await loadConfig(PROJECT_CONFIG_PATH);
  const results = await Promise.all(
    files.map(async (file) => {
      // Placed in base's folder, the file sits next to the ignore files as it would in the project.
      const filepath = path.join(BASE_TEMPLATE_DIR, file.target);
      const { ignored, inferredParser } = await prettier.getFileInfo(filepath, {
        ignorePath: PROJECT_IGNORE_PATHS,
        resolveConfig: false,
      });
      if (ignored || inferredParser === null) return undefined;
      const isFormatted = await prettier.check(file.content, { ...config, filepath });
      return isFormatted ? undefined : file;
    }),
  );
  return results.filter((file) => file !== undefined);
}

async function allTemplateFiles(): Promise<(ProjectFile & { layerId: string })[]> {
  const filesPerLayer = await Promise.all(
    BUILT_IN_LAYER_SET.layers.map((layer) =>
      listTemplateFiles(layer.id, BUILT_IN_LAYER_SET.templatesDir),
    ),
  );
  return Promise.all(
    filesPerLayer.flat().map(async (file) => ({
      ...file,
      content: await readFile(file.source, 'utf8'),
    })),
  );
}

describe('formatting of generated projects', () => {
  it('keeps every template file prettier-clean under the project config', async () => {
    const unformatted = await unformattedFiles(await allTemplateFiles());

    expect(unformatted.map((file) => `${file.layerId}: ${file.target}`)).toEqual([]);
  });

  it('renders prettier-clean files for every ready combo', async () => {
    const readyCombos = listCombos().filter((combo) =>
      isComboReady(combo, BUILT_IN_LAYER_SET.layers),
    );

    const unformattedPerCombo = await Promise.all(
      readyCombos.map(async (combo) => {
        const plan = await composeProject(optionsForCombo(combo), BUILT_IN_LAYER_SET);
        const unformatted = await unformattedFiles(plan.renderedFiles);
        return unformatted.map((file) => `${combo.id}: ${file.target}`);
      }),
    );

    expect(unformattedPerCombo.flat()).toEqual([]);
  });

  // The repo's own `pnpm format` (and editors, which find no config named `_prettierrc`) format
  // the templates with the root config, so it must not drift from the one projects get.
  it('formats the templates in this repo with the same settings as generated projects', async () => {
    expect(await loadConfig(REPO_CONFIG_PATH)).toEqual(await loadConfig(PROJECT_CONFIG_PATH));
  });
});
