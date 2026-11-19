import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import { readYamlFile } from '../support/project.ts';

const stepsSchema = z.array(z.record(z.string(), z.unknown()));
const workflowSchema = z.object({
  jobs: z.object({
    check: z.object({ steps: stepsSchema }),
    web: z.object({ steps: stepsSchema }).optional(),
  }),
});

async function readWorkflow(args: string[]) {
  const projectDir = await generateProject(args);
  return workflowSchema.parse(await readYamlFile(projectDir, '.github/workflows/ci.yml'));
}

describe('.github/workflows/ci.yml', () => {
  it.each([
    { packageManager: 'npm', install: 'npm ci', test: 'npm run test' },
    { packageManager: 'pnpm', install: 'pnpm install --frozen-lockfile', test: 'pnpm test' },
    { packageManager: 'yarn', install: 'yarn install --frozen-lockfile', test: 'yarn test' },
    { packageManager: 'bun', install: 'bun install --frozen-lockfile', test: 'bun run test' },
  ])(
    'installs and runs the checks with $packageManager',
    async ({ packageManager, install, test }) => {
      const workflow = await readWorkflow(['--pm', packageManager]);

      expect(workflow.jobs.check.steps).toEqual(
        expect.arrayContaining([{ run: install }, { run: test }]),
      );
    },
  );

  it('runs lint, format:check and typecheck before the tests', async () => {
    const workflow = await readWorkflow(['--pm', 'npm']);

    expect(workflow.jobs.check.steps.slice(-4)).toEqual([
      { run: 'npm run lint' },
      { run: 'npm run format:check' },
      { run: 'npm run typecheck' },
      { run: 'npm run test' },
    ]);
  });

  it('enables Corepack before setting up Node with yarn, so CI runs the yarn the project pins', async () => {
    const workflow = await readWorkflow(['--pm', 'yarn']);

    expect(workflow.jobs.check.steps.slice(0, 3)).toMatchObject([
      { uses: 'actions/checkout@v7' },
      { run: 'corepack enable' },
      { uses: 'actions/setup-node@v7', with: { cache: 'yarn' } },
    ]);
  });

  it('lets pnpm/action-setup read the pnpm version from packageManager', async () => {
    const workflow = await readWorkflow(['--pm', 'pnpm']);

    expect(workflow.jobs.check.steps).toContainEqual({ uses: 'pnpm/action-setup@v6' });
  });

  it('builds web/ with bun in an API + web project', async () => {
    const workflow = await readWorkflow(['--type', 'fullstack']);

    expect(workflow.jobs.web?.steps).toEqual(
      expect.arrayContaining([
        { uses: 'oven-sh/setup-bun@v2' },
        { run: 'bun install --frozen-lockfile' },
        { run: 'bun run generate' },
      ]),
    );
  });

  it('has no front end job in an API project', async () => {
    const workflow = await readWorkflow(['--type', 'api']);

    expect(workflow.jobs.web).toBeUndefined();
  });
});
