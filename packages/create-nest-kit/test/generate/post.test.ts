import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_COMMIT_MESSAGE, initGitRepository } from '../../src/generate/post.ts';

const execFileAsync = promisify(execFile);

describe('initGitRepository', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-git-'));
    // A fixed identity, so the commit doesn't depend on the machine's git config.
    vi.stubEnv('GIT_AUTHOR_NAME', 'Test');
    vi.stubEnv('GIT_AUTHOR_EMAIL', 'test@example.com');
    vi.stubEnv('GIT_COMMITTER_NAME', 'Test');
    vi.stubEnv('GIT_COMMITTER_EMAIL', 'test@example.com');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates a repository with every file in the initial commit', async () => {
    await writeFile(path.join(directory, 'README.md'), '# demo\n');

    const result = await initGitRepository(directory);

    expect(result).toEqual({ status: 'committed' });
    const { stdout } = await execFileAsync('git', ['log', '--format=%s', '--name-only'], {
      cwd: directory,
    });
    expect(stdout.trim().split('\n')).toEqual([INITIAL_COMMIT_MESSAGE, '', 'README.md']);
  });

  it('skips a directory that is already inside a repository', async () => {
    await execFileAsync('git', ['init'], { cwd: directory });
    const nested = path.join(directory, 'nested');
    await mkdir(nested);

    expect(await initGitRepository(nested)).toEqual({
      status: 'skipped',
      reason: 'the directory is already inside a git repository',
    });
  });
});
