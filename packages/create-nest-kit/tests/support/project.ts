import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/** A file of a generated project, by its path relative to the project. */
export function readProjectFile(projectDir: string, file: string): Promise<string> {
  return readFile(path.join(projectDir, file), 'utf8');
}

export async function readJsonFile(projectDir: string, file: string): Promise<unknown> {
  return JSON.parse(await readProjectFile(projectDir, file));
}

export async function readYamlFile(projectDir: string, file: string): Promise<unknown> {
  return parseYaml(await readProjectFile(projectDir, file));
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Every file under `directory`, as sorted POSIX paths relative to it. */
export async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .map((relativePath) => relativePath.split(path.sep).join('/'))
    .toSorted();
}

const pinsSchema = z.record(z.string(), z.string()).default({});

const packageJsonSchema = z.object({
  name: z.string(),
  packageManager: z.string().optional(),
  scripts: z.record(z.string(), z.string()).default({}),
  dependencies: pinsSchema,
  devDependencies: pinsSchema,
});

export type PackageJson = z.infer<typeof packageJsonSchema>;

/** A generated `package.json` (the project's, or `web/package.json`), checked for the fields tests read. */
export async function readPackageJson(
  projectDir: string,
  file = 'package.json',
): Promise<PackageJson> {
  return packageJsonSchema.parse(await readJsonFile(projectDir, file));
}

/** The `KEY=value` lines of a dotenv file, as a record. */
export function parseEnvFile(content: string): Record<string, string> {
  const pairs = content
    .split('\n')
    .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)] as const;
    });
  return Object.fromEntries(pairs);
}
