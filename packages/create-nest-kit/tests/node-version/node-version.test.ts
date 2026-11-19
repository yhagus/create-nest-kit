import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorkDir, runCli } from '../support/cli.ts';
import { PACKAGE_ROOT, REPO_ROOT } from '../support/paths.ts';
import { readJsonFile } from '../support/project.ts';

/** Node.js flags that make the CLI see `version` as the running Node.js version. */
function pretendNodeVersion(version: string): string[] {
  const preload = `Object.defineProperty(process.versions, 'node', { value: '${version}' });`;
  return ['--import', `data:text/javascript,${encodeURIComponent(preload)}`];
}

describe('the Node.js version check', () => {
  it.each(['24.14.9', '22.22.0', '18.20.8'])(
    'refuses Node.js %s with an install hint',
    async (version) => {
      const workDir = await createWorkDir();

      const result = await runCli(['--version'], {
        cwd: workDir,
        nodeArgs: pretendNodeVersion(version),
      });

      expect(result).toEqual({
        exitCode: 1,
        stdout: '',
        stderr:
          `create-nest-kit needs Node.js 24.15.0 or newer, but this is Node.js ${version}.\n` +
          'Install Node.js 24 from https://nodejs.org, or with `fnm install 24` or `nvm install 24`.\n',
      });
    },
  );

  it.each(['24.15.0', '25.0.0-nightly20260101', '100.0.0'])(
    'runs on Node.js %s',
    async (version) => {
      const workDir = await createWorkDir();

      const result = await runCli(['--help'], {
        cwd: workDir,
        nodeArgs: pretendNodeVersion(version),
      });

      expect(result.exitCode).toBe(0);
    },
  );

  // The minimum is written in three places that must agree with what the CLI accepts.
  it('states the minimum the CLI enforces in engines.node and in install.sh', async () => {
    const { engines } = z
      .object({ engines: z.object({ node: z.string() }) })
      .parse(await readJsonFile(PACKAGE_ROOT, 'package.json'));
    const installScript = await readFile(path.join(REPO_ROOT, 'install.sh'), 'utf8');

    expect(engines.node).toBe('>=24.15');
    expect(installScript).toMatch(/^MIN_NODE="24\.15\.0"$/m);
  });
});
