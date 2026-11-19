import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createWorkDir, generateProject, runCli } from '../support/cli.ts';
import { listFiles } from '../support/project.ts';

/** The paths of the "Files (n):" section of a --dry-run listing. */
function listedFiles(dryRunOutput: string): string[] {
  const section = /^Files \(\d+\):\n((?: {2}.+\n)+)/m.exec(dryRunOutput)?.[1] ?? '';
  return section
    .trimEnd()
    .split('\n')
    .map((line) => line.trim().split(/ +/)[0] ?? '');
}

describe('--dry-run', () => {
  it('lists the layers, the files with their origin and the pinned dependencies, and writes nothing', async () => {
    const workDir = await createWorkDir();

    const result = await runCli(['my-api', '--yes', '--dry-run'], { cwd: workDir });

    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    expect(result.stdout).toContain(
      [
        'Layers:',
        '  base',
        '  layout/nested',
        '  platform/fastify',
        '  database/postgres',
        '  validation/zod',
        '  pattern/service/core',
        '  persistence/drizzle/core',
        '  persistence/drizzle/auth-jwt',
        '  auth/jwt',
        '  pattern/service/auth-jwt',
        '',
      ].join('\n'),
    );
    expect(result.stdout).toMatch(/\n {2}src\/bootstrap\/create-app\.ts +platform\/fastify\n/);
    expect(result.stdout).toMatch(/\n {2}package\.json +rendered\n/);
    expect(result.stdout).toMatch(
      /\nDependencies:\n(?: {2}.+\n)* {2}@nestjs\/core@\d+\.\d+\.\d+\n/,
    );
    expect(result.stdout).toMatch(/\nDev dependencies:\n(?: {2}.+\n)* {2}vitest@\d+\.\d+\.\d+\n/);
    expect(result.stdout).toMatch(/Dry run: nothing was written\.\n$/);
    expect(await readdir(workDir)).toEqual([]);
  });

  it('composes the layers of the chosen options in order, the front end last', async () => {
    const workDir = await createWorkDir();

    const args = (
      'my-api --yes --dry-run --type fullstack --platform express --db mongodb --auth nest ' +
      '--validation valibot --pattern cqrs --layout flat'
    ).split(' ');

    const result = await runCli(args, { cwd: workDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(
      new RegExp(
        [
          '^Layers:',
          '  base',
          '  layout/flat',
          '  platform/express',
          '  database/mongodb',
          '  validation/valibot',
          '  pattern/cqrs/core',
          '  persistence/mongoose/core',
          '  persistence/mongoose/auth-nest',
          '  auth/nest',
          '  pattern/cqrs/auth-nest',
          '  web/nuxt\n\n',
        ].join('\n'),
      ),
    );
  });

  it('lists exactly the files a real run writes', async () => {
    const workDir = await createWorkDir();
    const args = ['--pattern', 'cqrs', '--layout', 'flat', '--type', 'fullstack'];

    const dryRun = await runCli(['app', '--yes', '--dry-run', ...args], { cwd: workDir });
    const projectDir = await generateProject(args);

    expect(listedFiles(dryRun.stdout).toSorted()).toEqual(await listFiles(projectDir));
  });
});
