import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { isRecord } from './json.js';

const execAsync = promisify(exec);

export interface ScriptOutput {
  stdout: string;
  stderr: string;
}

/**
 * Runs a script of package.json (`db:migrate`, `db:seed`) the way the package manager would:
 * through a shell, with node_modules/.bin on the PATH. `env` is added to the current environment.
 * Rejects when the script exits non-zero; the error message holds its stderr.
 */
export async function runPackageScript(
  name: string,
  env: Record<string, string>,
): Promise<ScriptOutput> {
  const command = await packageScript(name);
  const binDir = path.resolve('node_modules', '.bin');
  // The command is the project's own package.json script, which may chain commands with `&&`.
  return execAsync(command, {
    env: { ...process.env, ...env, PATH: `${binDir}${path.delimiter}${process.env['PATH'] ?? ''}` },
  });
}

async function packageScript(name: string): Promise<string> {
  const manifest: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  const scripts = isRecord(manifest) ? manifest['scripts'] : undefined;
  const command = isRecord(scripts) ? scripts[name] : undefined;
  if (typeof command !== 'string') throw new Error(`package.json has no ${name} script`);
  return command;
}
