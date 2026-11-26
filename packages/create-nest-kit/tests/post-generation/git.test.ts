import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createWorkDir, runCli, testEnvironment } from '../support/cli.ts';
import { exists, listFiles } from '../support/project.ts';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, env: testEnvironment() });
  return stdout;
}

const NO_INSTALL = ['--yes', '--no-install'];

describe('the git repository', () => {
  it('is initialized with every generated file but .env in one initial commit', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['app', ...NO_INSTALL], { cwd: workDir });

    const projectDir = path.join(workDir, 'app');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized a git repository with an initial commit');
    expect(await git(projectDir, ['log', '--format=%s'])).toBe(
      'chore: scaffold with create-nest-kit\n',
    );
    const committed = (await git(projectDir, ['ls-files'])).trimEnd().split('\n').toSorted();
    const written = (await listFiles(projectDir)).filter((file) => !file.startsWith('.git/'));
    // .env holds the generated secrets, and the generated .gitignore keeps it out.
    expect(committed).toEqual(written.filter((file) => file !== '.env'));
    expect(await git(projectDir, ['status', '--porcelain'])).toBe('');
  });

  it('starts on main, the branch the CI pipelines run on', async () => {
    const workDir = await createWorkDir();

    await runCli(['app', ...NO_INSTALL], { cwd: workDir });

    expect(await git(path.join(workDir, 'app'), ['branch', '--show-current'])).toBe('main\n');
  });

  it('registers --remote as origin without pushing to it, and says how to push', async () => {
    const workDir = await createWorkDir();
    const remoteDir = path.join(workDir, 'remote.git');
    await git(workDir, ['init', '--quiet', '--bare', remoteDir]);

    const result = await runCli(['app', ...NO_INSTALL, '--remote', remoteDir], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(await git(path.join(workDir, 'app'), ['remote', 'get-url', 'origin'])).toBe(
      `${remoteDir}\n`,
    );
    expect(await git(remoteDir, ['rev-list', '--all'])).toBe('');
    expect(result.stdout).toContain('git push -u origin main');
  });

  it('still registers the remote when the initial commit fails', async () => {
    const workDir = await createWorkDir();
    // No identity, and git may not guess one from the user and host names.
    const noIdentity = {
      GIT_AUTHOR_NAME: undefined,
      GIT_AUTHOR_EMAIL: undefined,
      GIT_COMMITTER_NAME: undefined,
      GIT_COMMITTER_EMAIL: undefined,
      EMAIL: undefined,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.useConfigOnly',
      GIT_CONFIG_VALUE_0: 'true',
    };

    const result = await runCli(['app', ...NO_INSTALL, '--remote', 'git@gitlab.com:acme/app.git'], {
      cwd: workDir,
      env: noIdentity,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('the initial commit failed');
    expect(await git(path.join(workDir, 'app'), ['remote', 'get-url', 'origin'])).toBe(
      'git@gitlab.com:acme/app.git\n',
    );
  });

  it('skips the remote, with a warning, inside an existing repository', async () => {
    const workDir = await createWorkDir();
    await git(workDir, ['init', '--quiet']);

    const result = await runCli(['app', ...NO_INSTALL, '--remote', 'git@github.com:acme/app.git'], {
      cwd: workDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Did not add the remote git@github.com:acme/app.git');
    expect(await git(workDir, ['remote'])).toBe('');
    expect(result.stdout).not.toContain('git push');
  });

  it('is skipped inside an existing repository', async () => {
    const workDir = await createWorkDir();
    await git(workDir, ['init', '--quiet']);
    await mkdir(path.join(workDir, 'services'));

    const result = await runCli(['services/app', ...NO_INSTALL], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'Skipped git: the directory is already inside a git repository',
    );
    expect(await exists(path.join(workDir, 'services/app/.git'))).toBe(false);
    expect(await git(workDir, ['rev-list', '--all'])).toBe('');
  });

  it('is not created with --no-git', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['app', ...NO_INSTALL, '--no-git'], { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(await exists(path.join(workDir, 'app/.git'))).toBe(false);
  });
});
