import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorkDir, runCli } from '../support/cli.ts';
import { PACKAGE_ROOT } from '../support/paths.ts';
import { readJsonFile } from '../support/project.ts';

describe('--help', () => {
  it.each(['--help', '-h'])(
    '%s prints the usage and the options, and writes nothing',
    async (flag) => {
      const workDir = await createWorkDir();

      const result = await runCli([flag], { cwd: workDir });

      expect(result).toMatchObject({ exitCode: 0, stderr: '' });
      expect(result.stdout).toMatch(/^Usage: create-nest-kit \[dir\] \[options\]\n/);
      expect(result.stdout).toContain('--db <postgres|mongodb>');
      expect(result.stdout).toContain('--layout <nested|flat>');
      expect(result.stdout).toContain('--dry-run');
      expect(await readdir(workDir)).toEqual([]);
    },
  );
});

describe('--version', () => {
  // The version changes with every release, so it is read from the package rather than written here.
  it.each(['--version', '-v'])('%s prints the version from package.json', async (flag) => {
    const workDir = await createWorkDir();
    const { version } = z
      .object({ version: z.string() })
      .parse(await readJsonFile(PACKAGE_ROOT, 'package.json'));

    const result = await runCli([flag], { cwd: workDir });

    expect(result).toEqual({ exitCode: 0, stdout: `${version}\n`, stderr: '' });
  });
});
