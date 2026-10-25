import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const FIXTURE_LAYER_SET = fileURLToPath(new URL('./fixtures/layers.ts', import.meta.url));

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs the built CLI against the fixture layers, never throwing on a non-zero exit. */
function runCli(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...args],
      {
        cwd,
        env: {
          ...process.env,
          NEST_KIT_LAYER_SET_MODULE: FIXTURE_LAYER_SET,
          NO_COLOR: '1',
          ...env,
        },
      },
      (error, stdout, stderr) => {
        const exitCode = error ? Number(error.code ?? 1) : 0;
        resolve({ exitCode, stdout, stderr });
      },
    );
  });
}

describe('create-nest-kit CLI', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-cli-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('prints the plan for --yes --dry-run and writes nothing', async () => {
    const result = await runCli(workDir, ['my-api', '--yes', '--dry-run']);

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(result.stdout).toContain(
      'Layers:\n  base\n  platform/fastify\n  database/postgres\n  validation/zod\n',
    );
    expect(result.stdout).toMatch(/src\/bootstrap\/create-app\.ts +platform\/fastify/);
    expect(result.stdout).toContain('@nestjs/core@12.2.0');
    await expect(access(path.join(workDir, 'my-api'))).rejects.toThrow('ENOENT');
  });

  it('writes the project with --yes', async () => {
    const result = await runCli(workDir, ['my-api', '--yes', '--no-install', '--no-git']);

    expect(result.exitCode).toBe(0);
    const packageJson: unknown = JSON.parse(
      await readFile(path.join(workDir, 'my-api/package.json'), 'utf8'),
    );
    expect(packageJson).toMatchObject({ name: 'my-api' });
    await expect(access(path.join(workDir, 'my-api/.gitignore'))).resolves.toBeUndefined();
  });

  it('pins the version of the package manager that launched it', async () => {
    const result = await runCli(workDir, ['my-api', '--yes', '--no-install', '--no-git'], {
      npm_config_user_agent: 'yarn/4.9.1 npm/? node/v24.15.0 linux x64',
    });

    expect(result.exitCode).toBe(0);
    const packageJson: unknown = JSON.parse(
      await readFile(path.join(workDir, 'my-api/package.json'), 'utf8'),
    );
    expect(packageJson).toHaveProperty('packageManager', 'yarn@4.9.1');
  });

  it('refuses a non-empty directory without --force, leaving it untouched', async () => {
    await mkdir(path.join(workDir, 'my-api'));
    await writeFile(path.join(workDir, 'my-api/notes.txt'), 'keep me');

    const result = await runCli(workDir, ['my-api', '--yes', '--no-install', '--no-git']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Pass --force');
    await expect(access(path.join(workDir, 'my-api/package.json'))).rejects.toThrow('ENOENT');
  });

  it('refuses a combination with a planned layer, naming the layer', async () => {
    const result = await runCli(workDir, [
      'my-api',
      '--yes',
      '--no-install',
      '--no-git',
      '--validation',
      'valibot',
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'This combination is not available yet. Planned layers: validation/valibot',
    );
    await expect(access(path.join(workDir, 'my-api'))).rejects.toThrow('ENOENT');
  });

  it('fails fast with a hint on an incompatible database and ORM', async () => {
    const result = await runCli(workDir, ['--db', 'mongodb', '--orm', 'drizzle']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      '--orm drizzle is not available for MongoDB; use --orm mongoose',
    );
  });
});
