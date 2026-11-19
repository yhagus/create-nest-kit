import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkDir, QUIET_FLAGS, runCli } from '../support/cli.ts';
import { exists, readJsonFile, readProjectFile } from '../support/project.ts';

describe('where the project goes', () => {
  it('creates nest-api in the current folder when no folder is given', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(QUIET_FLAGS, { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created nest-api in');
    expect(result.stdout).toContain('cd nest-api');
    expect(await readJsonFile(path.join(workDir, 'nest-api'), 'package.json')).toMatchObject({
      name: 'nest-api',
    });
  });

  it('creates a nested path, naming the package after its last segment', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['services/billing-api', ...QUIET_FLAGS], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('cd services/billing-api');
    expect(
      await readJsonFile(path.join(workDir, 'services/billing-api'), 'package.json'),
    ).toMatchObject({ name: 'billing-api' });
  });

  it('writes into the current folder with ".", with no cd in the next steps', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'orders-api');
    await mkdir(projectDir);

    const result = await runCli(['.', ...QUIET_FLAGS], { cwd: projectDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('cd ');
    expect(await readJsonFile(projectDir, 'package.json')).toMatchObject({ name: 'orders-api' });
  });

  it('quotes a folder with spaces in the cd of the next steps', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['My Api', '--name', 'my-api', ...QUIET_FLAGS], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cd 'My Api'");
  });
});

describe('a folder that is not empty', () => {
  it('is refused without --force and left untouched', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'app');
    await mkdir(projectDir);
    await writeFile(path.join(projectDir, 'notes.txt'), 'keep me');

    const result = await runCli(['app', ...QUIET_FLAGS], { cwd: workDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('is not empty. Pass --force to write into it anyway');
    expect(await readdir(projectDir)).toEqual(['notes.txt']);
  });

  it('is written into with --force, replacing files of the same name and keeping the others', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'app');
    await mkdir(projectDir);
    await writeFile(path.join(projectDir, 'notes.txt'), 'keep me');
    await writeFile(path.join(projectDir, 'package.json'), '{ "name": "old" }');

    const result = await runCli(['app', '--force', ...QUIET_FLAGS], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(await readFile(path.join(projectDir, 'notes.txt'), 'utf8')).toBe('keep me');
    expect(await readJsonFile(projectDir, 'package.json')).toMatchObject({ name: 'app' });
  });
});

describe('the package name', () => {
  it('is required with --yes when the folder name is not a valid package name, with a suggestion', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'My Apps');
    await mkdir(projectDir);

    const result = await runCli(['.', ...QUIET_FLAGS], { cwd: projectDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      `"My Apps" can't be a package name: it contains capital letters. Pass --name my-apps`,
    );
    expect(await exists(path.join(projectDir, 'package.json'))).toBe(false);
  });

  it('comes from --name instead of the folder, in package.json and .env', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'My Apps');
    await mkdir(projectDir);

    const result = await runCli(['.', '--name', 'my-apps', ...QUIET_FLAGS], { cwd: projectDir });

    expect(result.exitCode).toBe(0);
    expect(await readJsonFile(projectDir, 'package.json')).toMatchObject({ name: 'my-apps' });
    expect(await readProjectFile(projectDir, '.env')).toContain('\nAPP_NAME=my-apps\n');
  });

  it('may be scoped', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['app', '--name', '@acme/api', ...QUIET_FLAGS], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(await readJsonFile(path.join(workDir, 'app'), 'package.json')).toMatchObject({
      name: '@acme/api',
    });
  });
});
