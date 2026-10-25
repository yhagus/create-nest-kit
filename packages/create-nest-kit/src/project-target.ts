import path from 'node:path';
import { UsageError } from './args.ts';
import { packageNameProblem } from './options.ts';

// Where the project goes and what its package is called, kept apart from the prompts so it can be
// unit-tested.

/** The folder created when none is given, and the package name when nothing usable is left. */
export const DEFAULT_DIRECTORY = 'nest-api';

/** A folder name turned into a valid npm package name: `My Apps` becomes `my-apps`. */
export function toValidPackageName(folderName: string): string {
  const name = folderName
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._~-]+/g, '-')
    .replace(/^[._-]+/, '')
    .replaceAll(/-{2,}/g, '-')
    .replace(/-+$/, '');
  return packageNameProblem(name) === undefined ? name : DEFAULT_DIRECTORY;
}

/** The package name, settled from --name or the target folder's name, or a prompt suggesting one. */
export type PackageNameStep =
  | { kind: 'known'; name: string }
  | { kind: 'ask'; folderName: string; problem: string; suggestion: string };

/** `explicitName` comes from --name, which the argument parser has already validated. */
export function packageNameStep(
  cwd: string,
  directory: string,
  explicitName: string | undefined,
): PackageNameStep {
  if (explicitName !== undefined) return { kind: 'known', name: explicitName };

  const folderName = path.basename(path.resolve(cwd, directory));
  const problem = packageNameProblem(folderName);
  if (problem === undefined) return { kind: 'known', name: folderName };
  return { kind: 'ask', folderName, problem, suggestion: toValidPackageName(folderName) };
}

/** The package name for --yes, where there is no prompt: an invalid folder name needs --name. */
export function nonInteractivePackageName(
  cwd: string,
  directory: string,
  explicitName: string | undefined,
): string {
  const step = packageNameStep(cwd, directory, explicitName);
  if (step.kind === 'known') return step.name;
  throw new UsageError(
    `"${step.folderName}" can't be a package name: ${step.problem}. ` +
      `Pass --name ${step.suggestion} (or another valid npm package name).`,
  );
}

/** `absolutePath` with the home directory written as `~`, for showing to the user. */
export function shortenHomePath(absolutePath: string, homeDir: string): string {
  if (absolutePath === homeDir) return '~';
  const homePrefix = homeDir.endsWith(path.sep) ? homeDir : homeDir + path.sep;
  if (!absolutePath.startsWith(homePrefix)) return absolutePath;
  return path.join('~', absolutePath.slice(homePrefix.length));
}

/** `value` as a POSIX shell word, quoted only when it needs to be: `My Api` → `'My Api'`. */
export function shellQuote(value: string): string {
  return /^[\w./~-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}
