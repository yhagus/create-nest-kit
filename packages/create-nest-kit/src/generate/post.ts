import {
  execFile,
  spawn,
  type SpawnOptionsWithStdioTuple,
  type StdioNull,
  type StdioPipe,
} from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import * as p from '@clack/prompts';
import type { PackageManager } from '../options.ts';

const execFileAsync = promisify(execFile);

export const INITIAL_COMMIT_MESSAGE = 'chore: scaffold with create-nest-kit';

/** Runs `<packageManager> install` in `directory`, streaming its output into a clack task log. */
export async function installDependencies(
  directory: string,
  packageManager: PackageManager,
): Promise<void> {
  const log = p.taskLog({ title: `Installing dependencies with ${packageManager}` });
  const spawnOptions: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe> = {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  // npm, pnpm and yarn are .cmd shims on Windows, which Node only runs through a shell.
  // The command is built from the validated package manager name, never from user text.
  const child =
    process.platform === 'win32'
      ? spawn(`${packageManager} install`, { ...spawnOptions, shell: true })
      : spawn(packageManager, ['install'], spawnOptions);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => log.message(line));
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  }).catch((error: unknown) => {
    log.error(`Could not run ${packageManager}`, { showLog: true });
    throw new Error(`Could not run "${packageManager} install"`, { cause: error });
  });

  if (exitCode !== 0) {
    log.error(`${packageManager} install failed`, { showLog: true });
    throw new Error(`"${packageManager} install" exited with code ${exitCode}`);
  }
  log.success('Dependencies installed');
}

export type GitResult =
  | { status: 'committed' }
  | { status: 'skipped'; reason: string }
  | { status: 'not-committed'; reason: string };

/**
 * `git init`, then commits everything. Skips when git is missing or `directory`
 * is already inside a repository; a failed commit (e.g. no git identity) leaves
 * the repository initialised but empty.
 */
export async function initGitRepository(directory: string): Promise<GitResult> {
  const git = (...args: string[]) => execFileAsync('git', args, { cwd: directory });

  try {
    await git('--version');
  } catch {
    return { status: 'skipped', reason: 'git is not installed' };
  }
  if (await isInsideWorkTree(directory)) {
    return { status: 'skipped', reason: 'the directory is already inside a git repository' };
  }

  await git('init');
  await git('add', '--all');
  try {
    await git('commit', '--message', INITIAL_COMMIT_MESSAGE);
  } catch (error) {
    const stderr = isRecord(error) && typeof error.stderr === 'string' ? error.stderr.trim() : '';
    return { status: 'not-committed', reason: stderr || String(error) };
  }
  return { status: 'committed' };
}

async function isInsideWorkTree(directory: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: directory,
    });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
