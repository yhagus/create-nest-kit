import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mergeManifests, type MergedManifest } from '../layers/merge.ts';
import { resolveLayers } from '../layers/resolve.ts';
import type { LayerManifest, LayerSet } from '../layers/types.ts';
import type { Layout, ProjectOptions } from '../options.ts';
import { REQUIRED_SLOTS } from '../slots.ts';
import { projectPath } from './relocate.ts';
import { renderAggregateFiles, type RenderedFile } from './render.ts';
import { rewriteRelativeImports, type ImportStyle } from './rewrite-imports.ts';

/** A template file copied into the project: verbatim, or with its relative imports relocated. */
export interface TemplateFile {
  /** Path inside the generated project, with `/` separators. */
  target: string;
  /** Absolute path of the template on disk. */
  source: string;
  layerId: string;
  /** The content to write instead of copying `source`, when relocation changed its imports. */
  content?: string;
}

/** Source and test files, whose relative imports follow the files they import. */
const IMPORTING_FILE = /^(src|tests)\/.*\.ts$/;

/**
 * Folders a tool fills after generation (the Prisma client, by `prisma generate`). Imports into
 * them are valid although no layer provides the file.
 */
const TOOL_GENERATED_DIRS = ['src/generated/'];

/** The flat layout imports across modules through the `@/` alias its tsconfig.json declares. */
const IMPORT_STYLE_BY_LAYOUT: Record<Layout, ImportStyle> = {
  nested: 'relative',
  flat: 'alias-across-modules',
};

/** Everything a project consists of, before anything is written. */
export interface ProjectPlan {
  layers: LayerManifest[];
  templateFiles: TemplateFile[];
  renderedFiles: RenderedFile[];
  manifest: MergedManifest;
}

export class CompositionError extends Error {
  override name = 'CompositionError';
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The layers don't compose:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.problems = problems;
  }
}

/** Rendered files are owned by the generator; a template providing one is a collision too. */
const GENERATOR_OWNER = 'create-nest-kit (rendered)';

/**
 * Resolves the layers for `options` and plans every file of the project.
 * Throws CompositionError on path collisions or unfilled slots, and
 * ManifestConflictError when the layers' manifests disagree.
 */
export async function composeProject(
  options: ProjectOptions,
  layerSet: LayerSet,
  slots: readonly string[] = REQUIRED_SLOTS,
): Promise<ProjectPlan> {
  const layers = resolveLayers(options, layerSet.layers);
  const filesPerLayer = await Promise.all(
    layers.map((layer) => listTemplateFiles(layer.id, layerSet.templatesDir)),
  );
  const layoutFiles = filesPerLayer.flat();
  const manifest = mergeManifests(layers, options);
  const renderedFiles = renderAggregateFiles(options, manifest);

  const renderedPaths = renderedFiles.map((file) => ({
    target: file.target,
    layerId: GENERATOR_OWNER,
  }));
  const problems = findCompositionProblems([...layoutFiles, ...renderedPaths], slots);
  if (problems.length > 0) throw new CompositionError(problems);

  const templateFiles = await relocateTemplateFiles(layoutFiles, options);
  const relocationProblems = findCompositionProblems([...templateFiles, ...renderedPaths], []);
  if (relocationProblems.length > 0) throw new CompositionError(relocationProblems);

  return { layers, templateFiles, renderedFiles, manifest };
}

/**
 * Moves files from the templates' layout to the project's (see relocate.ts) and points the
 * relative imports of source and test files at the moved files, in the layout's import style.
 * Throws on an import of a file no layer provides.
 */
async function relocateTemplateFiles(
  files: readonly TemplateFile[],
  options: ProjectOptions,
): Promise<TemplateFile[]> {
  const projectPathByTemplatePath = new Map(
    files.map((file) => [file.target, projectPath(file.target, options)]),
  );
  const projectPathOf = (templatePath: string) => {
    const provided = projectPathByTemplatePath.get(templatePath);
    if (provided !== undefined) return provided;
    const isToolGenerated = TOOL_GENERATED_DIRS.some((dir) => templatePath.startsWith(dir));
    return isToolGenerated ? projectPath(templatePath, options) : undefined;
  };

  return Promise.all(
    files.map(async (file) => {
      const target = projectPath(file.target, options);
      if (!IMPORTING_FILE.test(file.target)) return { ...file, target };

      const original = await readFile(file.source, 'utf8');
      const content = rewriteRelativeImports(
        original,
        { templatePath: file.target, projectPath: target },
        projectPathOf,
        IMPORT_STYLE_BY_LAYOUT[options.layout],
      );
      return content === original ? { ...file, target } : { ...file, target, content };
    }),
  );
}

/** Lists a layer's template files. A layer without a template folder simply has no files. */
export async function listTemplateFiles(
  layerId: string,
  templatesDir: string,
): Promise<TemplateFile[]> {
  const layerDir = path.join(templatesDir, layerId);
  const entries = await readdirIfExists(layerDir);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(layerDir, path.join(entry.parentPath, entry.name)))
    .filter((relativePath) => !isIgnoredTemplatePath(relativePath))
    .map((relativePath) => ({
      target: toTargetPath(relativePath),
      source: path.join(layerDir, relativePath),
      layerId,
    }))
    .toSorted((a, b) => a.target.localeCompare(b.target, 'en'));
}

async function readdirIfExists(directory: string) {
  try {
    return await readdir(directory, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Real dotfiles in templates are ignored (npm would drop or rename some of them on publish,
 * and stray ones like .DS_Store must not leak into projects). Templates spell them with `_`.
 */
function isIgnoredTemplatePath(relativePath: string): boolean {
  return relativePath.split(path.sep).some((segment) => segment.startsWith('.'));
}

/**
 * `_gitignore` → `.gitignore`, `_github/workflows/x.yml` → `.github/workflows/x.yml`.
 * Two underscores escape one: `__journal.json` → `_journal.json`.
 */
export function toTargetPath(templateRelativePath: string): string {
  return templateRelativePath.split(path.sep).map(toTargetSegment).join('/');
}

function toTargetSegment(segment: string): string {
  if (segment.startsWith('__')) return segment.slice(1);
  if (segment.startsWith('_')) return `.${segment.slice(1)}`;
  return segment;
}

/** Paths claimed by more than one layer, and slots no layer fills. */
export function findCompositionProblems(
  files: readonly Pick<TemplateFile, 'target' | 'layerId'>[],
  slots: readonly string[],
): string[] {
  const ownersByPath = new Map<string, string[]>();
  for (const file of files) {
    ownersByPath.set(file.target, [...(ownersByPath.get(file.target) ?? []), file.layerId]);
  }

  const collisions = [...ownersByPath]
    .filter(([, owners]) => owners.length > 1)
    .map(
      ([target, owners]) => `${target} is provided by more than one layer: ${owners.join(', ')}`,
    );
  const unfilledSlots = slots
    .filter((slot) => !ownersByPath.has(slot))
    .map((slot) => `slot ${slot} is not provided by any layer`);
  return [...collisions, ...unfilledSlots];
}

/** Writes the plan into `targetDir`. Existing files at planned paths are replaced; nothing else is touched. */
export async function writeProject(plan: ProjectPlan, targetDir: string): Promise<void> {
  for (const file of plan.templateFiles) {
    const destination = await prepareDestination(targetDir, file.target);
    if (file.content === undefined) await copyFile(file.source, destination);
    else await writeFile(destination, file.content);
  }
  for (const file of plan.renderedFiles) {
    const destination = await prepareDestination(targetDir, file.target);
    await writeFile(destination, file.content);
  }
}

/** Creates the parent folder and removes a file already at the destination. */
async function prepareDestination(targetDir: string, target: string): Promise<string> {
  const destination = path.join(targetDir, ...target.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  // Replace, don't write through: a symlink at the destination would redirect the write to its target.
  await rm(destination, { force: true });
  return destination;
}
