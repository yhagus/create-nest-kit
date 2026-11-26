import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import { readYamlFile } from '../support/project.ts';

const jobSchema = z.object({
  image: z.string().optional(),
  variables: z.record(z.string(), z.string()).default({}),
  cache: z.object({ key: z.object({ files: z.array(z.string()) }), paths: z.array(z.string()) }),
  services: z.array(z.object({ name: z.string() })).default([]),
  before_script: z.array(z.string()),
  script: z.array(z.string()),
});
const pipelineSchema = z.object({
  workflow: z.object({ rules: z.array(z.object({ if: z.string() })) }),
  default: z.object({ image: z.string() }),
  check: jobSchema,
  web: jobSchema.optional(),
});

async function readPipeline(args: string[]) {
  const projectDir = await generateProject(['--ci', 'gitlab', ...args]);
  return pipelineSchema.parse(await readYamlFile(projectDir, '.gitlab-ci.yml'));
}

describe('.gitlab-ci.yml', () => {
  it.each([
    {
      packageManager: 'npm',
      setup: [],
      install: 'npm ci',
      lockfile: 'package-lock.json',
    },
    {
      packageManager: 'pnpm',
      setup: [
        'npm install --global corepack@0.36.0',
        'corepack enable',
        'pnpm config set store-dir $CI_PROJECT_DIR/.ci-cache/pnpm',
      ],
      install: 'pnpm install --frozen-lockfile',
      lockfile: 'pnpm-lock.yaml',
    },
    {
      packageManager: 'yarn',
      setup: ['npm install --global corepack@0.36.0', 'corepack enable'],
      install: 'yarn install --frozen-lockfile',
      lockfile: 'yarn.lock',
    },
    {
      packageManager: 'bun',
      setup: ['npm install --global bun@1.4.0'],
      install: 'bun install --frozen-lockfile',
      lockfile: 'bun.lock',
    },
  ])(
    'sets up $packageManager, caches its store by $lockfile and installs from the lockfile',
    async ({ packageManager, setup, install, lockfile }) => {
      const pipeline = await readPipeline(['--pm', packageManager]);

      expect(pipeline.check.before_script).toEqual([...setup, install]);
      expect(pipeline.check.cache).toEqual({
        key: { files: [lockfile] },
        paths: [`.ci-cache/${packageManager}/`],
      });
    },
  );

  it('runs lint, format:check, typecheck and the tests on the pinned Node image', async () => {
    const pipeline = await readPipeline(['--pm', 'pnpm']);

    expect(pipeline.default.image).toBe('node:26.13.1');
    expect(pipeline.check.script).toEqual([
      'pnpm lint',
      'pnpm format:check',
      'pnpm typecheck',
      'pnpm test',
    ]);
  });

  it('gives the tests a Docker daemon for Testcontainers', async () => {
    const pipeline = await readPipeline([]);

    expect(pipeline.check.services).toMatchObject([{ name: 'docker:dind' }]);
    expect(pipeline.check.variables).toMatchObject({ DOCKER_HOST: 'tcp://docker:2375' });
  });

  it('runs for merge requests and pushes to main only', async () => {
    const pipeline = await readPipeline([]);

    expect(pipeline.workflow.rules).toEqual([
      { if: '$CI_PIPELINE_SOURCE == "merge_request_event"' },
      { if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "main"' },
    ]);
  });

  it('builds web/ with bun in an API + web project', async () => {
    const pipeline = await readPipeline(['--type', 'fullstack']);

    expect(pipeline.web?.before_script).toEqual([
      'npm install --global bun@1.4.0',
      'cd web',
      'bun install --frozen-lockfile',
    ]);
    expect(pipeline.web?.script).toEqual(['bun run generate']);
    expect(pipeline.web?.cache.key.files).toEqual(['web/bun.lock']);
  });

  it('has no front end job in an API project', async () => {
    const pipeline = await readPipeline(['--type', 'api']);

    expect(pipeline.web).toBeUndefined();
  });
});
