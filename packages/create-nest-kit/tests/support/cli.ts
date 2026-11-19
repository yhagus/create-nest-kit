import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { onTestFinished } from 'vitest';
import { CLI_PATH } from './paths.ts';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd: string;
  /** Added to the environment the CLI runs in; `undefined` removes a variable. */
  env?: Record<string, string | undefined>;
  /** Node.js flags placed before the CLI's path, e.g. `--import <preload>`. */
  nodeArgs?: string[];
}

/** The machine-independent part of a test environment: no colours, and a git with no user config. */
const BASE_ENV = {
  NO_COLOR: '1',
  // The package manager that runs the suite (`pnpm test`) sets this, and the CLI would pin it.
  npm_config_user_agent: undefined,
  // Global and system git config (commit signing, hooks, default branch) stays out of the tests.
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
} satisfies Record<string, string | undefined>;

/** `process.env` with `overrides` applied, for a child process. */
export function testEnvironment(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

/** Runs the built CLI, resolving with its exit code and output instead of rejecting on failure. */
export function runCli(args: string[], options: RunOptions): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [...(options.nodeArgs ?? []), CLI_PATH, ...args],
      { cwd: options.cwd, env: testEnvironment(options.env), maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = error ? Number(error.code ?? 1) : 0;
        resolve({ exitCode, stdout, stderr });
      },
    );
  });
}

/** A fresh empty folder outside any git repository, removed when the current test finishes. */
export async function createWorkDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-test-'));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** The flags that make a run write a project and nothing else: no prompts, install or git. */
export const QUIET_FLAGS = ['--yes', '--no-install', '--no-git'];

/**
 * Generates a project with `--yes --no-install --no-git` plus `args` into `app/` of a fresh work
 * folder and returns the project's path. Fails the test with the CLI's output if it fails.
 */
export async function generateProject(
  args: string[] = [],
  env: RunOptions['env'] = {},
): Promise<string> {
  const workDir = await createWorkDir();
  const result = await runCli(['app', ...QUIET_FLAGS, ...args], { cwd: workDir, env });
  if (result.exitCode !== 0) {
    throw new Error(`create-nest-kit ${args.join(' ')} failed:\n${result.stderr}${result.stdout}`);
  }
  return path.join(workDir, 'app');
}
