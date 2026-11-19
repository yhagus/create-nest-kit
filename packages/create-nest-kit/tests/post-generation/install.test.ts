import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkDir, runCli } from '../support/cli.ts';
import { exists } from '../support/project.ts';

interface FakePackageManager {
  /** Prepend to PATH so the CLI runs the fake instead of the real package manager. */
  binDir: string;
  /** One `<working directory> <arguments>` line per run. */
  readCalls: () => Promise<string[]>;
}

/**
 * Package managers that only log how they were called, then exit with `exitCode`. The install
 * itself is the package manager's job; what the installer owns is running it, where and when.
 */
async function fakePackageManagers(
  workDir: string,
  exitCodes: Record<string, number>,
): Promise<FakePackageManager> {
  const binDir = path.join(workDir, 'bin');
  const callLog = path.join(workDir, 'calls.log');
  await mkdir(binDir);
  for (const [name, exitCode] of Object.entries(exitCodes)) {
    const script = `#!/bin/sh\necho "$PWD ${name} $*" >> '${callLog}'\nexit ${exitCode}\n`;
    await writeFile(path.join(binDir, name), script);
    await chmod(path.join(binDir, name), 0o755);
  }
  return {
    binDir,
    readCalls: async () => {
      if (!(await exists(callLog))) return [];
      return (await readFile(callLog, 'utf8')).trimEnd().split('\n');
    },
  };
}

function withPath(binDir: string): Record<string, string> {
  return { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` };
}

describe('installing dependencies', () => {
  it('runs the chosen package manager in the project folder', async () => {
    const workDir = await realpath(await createWorkDir());
    const fake = await fakePackageManagers(workDir, { pnpm: 0 });

    const result = await runCli(['app', '--yes', '--no-git', '--pm', 'pnpm'], {
      cwd: workDir,
      env: withPath(fake.binDir),
    });

    expect(result.exitCode).toBe(0);
    expect(await fake.readCalls()).toEqual([`${workDir}/app pnpm install`]);
    expect(result.stdout).toContain('Dependencies installed');
    expect(result.stdout).not.toMatch(/│ {2}pnpm install +│/);
  });

  it('also installs the front end with bun in an API + web project', async () => {
    const workDir = await realpath(await createWorkDir());
    const fake = await fakePackageManagers(workDir, { npm: 0, bun: 0 });

    const result = await runCli(['app', '--yes', '--no-git', '--type', 'fullstack'], {
      cwd: workDir,
      env: withPath(fake.binDir),
    });

    expect(result.exitCode).toBe(0);
    expect(await fake.readCalls()).toEqual([
      `${workDir}/app npm install`,
      `${workDir}/app/web bun install`,
    ]);
  });

  it('fails when the install fails, keeping the files it wrote', async () => {
    const workDir = await createWorkDir();
    const fake = await fakePackageManagers(workDir, { npm: 3 });

    const result = await runCli(['app', '--yes', '--no-git'], {
      cwd: workDir,
      env: withPath(fake.binDir),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"npm install" exited with code 3');
    expect(await exists(path.join(workDir, 'app/package.json'))).toBe(true);
  });

  it("only warns when the front end's install fails, keeping bun install in its next steps", async () => {
    const workDir = await createWorkDir();
    const fake = await fakePackageManagers(workDir, { npm: 0, bun: 1 });

    const result = await runCli(['app', '--yes', '--no-git', '--type', 'fullstack'], {
      cwd: workDir,
      env: withPath(fake.binDir),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("The front end's dependencies were not installed");
    expect(result.stdout).toContain('bun install');
  });

  it('is skipped with --no-install, which adds the install command to the next steps', async () => {
    const workDir = await createWorkDir();
    const fake = await fakePackageManagers(workDir, { pnpm: 0 });

    const result = await runCli(['app', '--yes', '--no-git', '--no-install', '--pm', 'pnpm'], {
      cwd: workDir,
      env: withPath(fake.binDir),
    });

    expect(result.exitCode).toBe(0);
    expect(await fake.readCalls()).toEqual([]);
    expect(result.stdout).toMatch(/cd app +│\n│ {2}pnpm install /);
  });
});
