import path from 'node:path';

/** A file's path in the templates' layout and in the generated project. */
export interface RelocatedFile {
  templatePath: string;
  projectPath: string;
}

/**
 * A relative specifier in `from '...'` (imports and re-exports), `import('...')` or
 * `vi.mock('...')`. Group 1 is everything before the specifier, 2 the quote, 3 the specifier.
 */
const RELATIVE_SPECIFIER = /(\bfrom\s+|\bimport\(\s*|\bvi\.mock\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

/** The print width of the generated projects' Prettier config (`templates/base/_prettierrc`). */
const PRINT_WIDTH = 100;

/** A one-line import or re-export of named bindings: `import type { a, b } from '...';` */
const ONE_LINE_NAMED_IMPORT = /^((?:import|export)(?: type)? )\{ (.+) \}( from (['"])[^'"]+\4;)$/;

/** The first line of an import or re-export wrapped one binding per line: `import {`. */
const WRAPPED_IMPORT_HEAD = /^(?:import|export)(?: type)? \{$/;
/** A binding line of a wrapped import: `  type User,`. */
const WRAPPED_IMPORT_BINDING = /^ {2}([^\s,][^,]*),$/;
/** The last line of a wrapped import: `} from '...';`. */
const WRAPPED_IMPORT_TAIL = /^\}( from (['"])[^'"]+\2;)$/;

/** TypeScript's NodeNext resolution: a `.js` specifier names the `.ts` file next to it. */
const COMPILED_EXTENSION = '.js';
const SOURCE_EXTENSION = '.ts';

/** The alias the flat layout's `tsconfig.json` maps to `src/`. */
const SOURCE_ALIAS = '@/';
const SOURCE_DIR = 'src';
const TEST_DIR = 'tests';

/**
 * How an import names the file it imports: always by relative path, or by the `@/` alias when it
 * leaves its own module (a top-level folder of `src/`, or `tests/`). A file directly in `src/`
 * belongs to no module, so every import from it uses the alias.
 */
export type ImportStyle = 'relative' | 'alias-across-modules';

/**
 * Points the relative imports of `file` at where their targets end up in the project.
 * `projectPathOf` maps a template path to its project path, or returns undefined for a path no
 * layer provides. A relative import neither of whose ends moved keeps its exact text, so a file
 * whose imports don't change comes back identical. An import that changed is wrapped or put back
 * on one line as Prettier would. Throws on an import that resolves to no file.
 */
export function rewriteRelativeImports(
  content: string,
  file: RelocatedFile,
  projectPathOf: (templatePath: string) => string | undefined,
  importStyle: ImportStyle = 'relative',
): string {
  const templateDir = path.posix.dirname(file.templatePath);
  const projectDir = path.posix.dirname(file.projectPath);
  const rewriteSpecifier = (match: string, prefix: string, quote: string, specifier: string) => {
    const importedTemplatePath = toSourcePath(path.posix.join(templateDir, specifier));
    const importedProjectPath = projectPathOf(importedTemplatePath);
    if (importedProjectPath === undefined) {
      throw new Error(
        `${file.templatePath} imports '${specifier}', which resolves to ${importedTemplatePath}: no layer provides that file`,
      );
    }
    const isCompiledSpecifier = specifier.endsWith(COMPILED_EXTENSION);
    const usesAlias =
      importStyle === 'alias-across-modules' &&
      moduleOf(file.projectPath) !== moduleOf(importedProjectPath);
    if (usesAlias) {
      const aliased = `${SOURCE_ALIAS}${path.posix.relative(SOURCE_DIR, importedProjectPath)}`;
      return `${prefix}${quote}${withExtension(aliased, isCompiledSpecifier)}${quote}`;
    }

    const isUnmoved =
      file.projectPath === file.templatePath && importedProjectPath === importedTemplatePath;
    if (isUnmoved) return match;
    const relocated = toRelativeSpecifier(
      path.posix.relative(projectDir, importedProjectPath),
      isCompiledSpecifier,
    );
    return `${prefix}${quote}${relocated}${quote}`;
  };

  // A specifier never spans lines, so each line is rewritten on its own; only imports whose
  // specifier changed are rewrapped.
  const lines = content.split('\n');
  const rewrittenLines = lines.map((line) => line.replaceAll(RELATIVE_SPECIFIER, rewriteSpecifier));
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const rewritten = rewrittenLines[index] ?? '';
    const wrappedImportEnd = WRAPPED_IMPORT_HEAD.test(line)
      ? wrappedImportEndIndex(lines, index)
      : undefined;
    if (wrappedImportEnd !== undefined) {
      const statement = rewrittenLines.slice(index, wrappedImportEnd + 1);
      const hasChanged = rewrittenLines[wrappedImportEnd] !== lines[wrappedImportEnd];
      output.push(...(hasChanged ? unwrapShortImport(statement) : statement));
      index = wrappedImportEnd;
    } else {
      output.push(rewritten === line ? line : wrapLongImport(rewritten));
    }
  }
  return output.join('\n');
}

/**
 * The module a project file belongs to, for the `@/` rule: `src/<folder>`, `tests`, or the file
 * itself when it sits directly in `src/`.
 */
function moduleOf(projectFilePath: string): string {
  const [root, folder, ...rest] = projectFilePath.split('/');
  if (root === TEST_DIR) return TEST_DIR;
  if (root === SOURCE_DIR && folder !== undefined && rest.length > 0) {
    return `${SOURCE_DIR}/${folder}`;
  }
  return projectFilePath;
}

/** The index of the `} from '...';` line closing the wrapped import that starts at `start`. */
function wrappedImportEndIndex(lines: readonly string[], start: number): number | undefined {
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (WRAPPED_IMPORT_TAIL.test(line)) return index;
    if (!WRAPPED_IMPORT_BINDING.test(line)) return undefined;
  }
  return undefined;
}

/**
 * Puts a wrapped import back on one line when it fits the print width, as Prettier does: it
 * keeps an import's bindings on one line whenever they fit.
 */
function unwrapShortImport(statement: readonly string[]): readonly string[] {
  const head = statement[0] ?? '';
  const tail = WRAPPED_IMPORT_TAIL.exec(statement.at(-1) ?? '')?.[1] ?? '';
  const bindings = statement
    .slice(1, -1)
    .map((line) => WRAPPED_IMPORT_BINDING.exec(line)?.[1] ?? line.trim());
  const oneLine = `${head} ${bindings.join(', ')} }${tail}`;
  return oneLine.length <= PRINT_WIDTH ? [oneLine] : statement;
}

/**
 * Breaks an import that relocation made longer than the print width the way Prettier does: one
 * binding per line. Prettier keeps an import of a single binding on one line, whatever its length.
 */
function wrapLongImport(line: string): string {
  if (line.length <= PRINT_WIDTH) return line;
  const match = ONE_LINE_NAMED_IMPORT.exec(line);
  if (match === null) return line;
  const [, head = '', bindingList = '', tail = ''] = match;
  const bindings = bindingList.split(', ');
  if (bindings.length < 2) return line;
  return [`${head}{`, ...bindings.map((binding) => `  ${binding},`), `}${tail}`].join('\n');
}

function toSourcePath(resolvedSpecifier: string): string {
  if (!resolvedSpecifier.endsWith(COMPILED_EXTENSION)) return resolvedSpecifier;
  return `${resolvedSpecifier.slice(0, -COMPILED_EXTENSION.length)}${SOURCE_EXTENSION}`;
}

/** `users/user.ts` → `users/user.js` for a specifier that names the compiled file. */
function withExtension(sourcePath: string, isCompiledSpecifier: boolean): string {
  if (!isCompiledSpecifier) return sourcePath;
  return `${sourcePath.slice(0, -SOURCE_EXTENSION.length)}${COMPILED_EXTENSION}`;
}

function toRelativeSpecifier(relativeSourcePath: string, isCompiledSpecifier: boolean): string {
  const specifier = withExtension(relativeSourcePath, isCompiledSpecifier);
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}
