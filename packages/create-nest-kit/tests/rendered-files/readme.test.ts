import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { readProjectFile } from '../support/project.ts';

async function readReadme(args: string[]): Promise<string> {
  return readProjectFile(await generateProject(args), 'README.md');
}

/** The body of the README's ```sh block under "## Quickstart". */
function quickstartCommands(readme: string): string {
  return /## Quickstart\n\n```sh\n([\s\S]*?)```/.exec(readme)?.[1] ?? '';
}

describe('README.md', () => {
  it('records the options the project was generated with', async () => {
    const readme = await readReadme([
      '--platform',
      'express',
      '--orm',
      'prisma',
      '--layout',
      'flat',
    ]);

    expect(readme).toMatch(/^# app\n/);
    expect(readme).toMatch(/\| HTTP platform +\| Express +\|/);
    expect(readme).toMatch(/\| ORM \/ ODM +\| Prisma 7 +\|/);
    expect(readme).toMatch(/\| Folder layout +\| Flat +\|/);
  });

  it('adds the sections of the chosen layers', async () => {
    const readme = await readReadme(['--db', 'mongodb', '--validation', 'arktype']);

    expect(readme).toContain('\n## Database (Mongoose)\n');
    expect(readme).toContain('\n## Validation (ArkType)\n');
    expect(readme).not.toContain('\n## Database (Drizzle)\n');
  });

  it.each([
    { packageManager: 'pnpm', run: 'pnpm' },
    { packageManager: 'npm', run: 'npm run' },
    { packageManager: 'yarn', run: 'yarn' },
    { packageManager: 'bun', run: 'bun run' },
  ])('runs the quickstart with $packageManager', async ({ packageManager, run }) => {
    const readme = await readReadme(['--pm', packageManager]);

    expect(quickstartCommands(readme)).toBe(
      [
        `${packageManager} install`,
        'docker compose up -d',
        `${run} db:migrate`,
        `${run} db:seed`,
        `${run} start:dev`,
        '',
      ].join('\n'),
    );
  });

  it('follows the dev container instead of running the scripts with --dev-env docker', async () => {
    const readme = await readReadme(['--dev-env', 'docker', '--pm', 'pnpm']);

    expect(quickstartCommands(readme)).toBe(
      'pnpm install\ndocker compose up -d\ndocker compose logs -f api\n',
    );
  });

  it('starts the front end from web/ with bun in a local API + web project', async () => {
    const readme = await readReadme(['--type', 'fullstack']);

    expect(readme).toContain('\ncd web\nbun install\nbun run dev\n');
  });

  it('follows both containers in a docker API + web project', async () => {
    const readme = await readReadme(['--type', 'fullstack', '--dev-env', 'docker']);

    expect(quickstartCommands(readme)).toContain('\ndocker compose logs -f api web\n');
    expect(readme).not.toContain('\nbun run dev\n');
  });
});
