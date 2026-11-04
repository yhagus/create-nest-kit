import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { mergeManifests } from '../../src/layers/merge.ts';
import { resolveLayers } from '../../src/layers/resolve.ts';
import { renderCiWorkflow } from '../../src/generate/render-ci.ts';
import { renderDockerCompose } from '../../src/generate/render-compose.ts';
import { renderEnv, renderEnvExample } from '../../src/generate/render-env.ts';
import { renderPackageJson } from '../../src/generate/render-package-json.ts';
import { renderReadme } from '../../src/generate/render-readme.ts';
import { parseProjectOptions, type ProjectOptionsInput } from '../../src/options.ts';
import { fixtureLayers } from '../fixtures/layers.ts';

function fixtureProject(input: Partial<ProjectOptionsInput> = {}) {
  const options = parseProjectOptions({ name: 'demo', directory: 'demo', ...input });
  const manifest = mergeManifests(resolveLayers(options, fixtureLayers), options);
  return { options, manifest };
}

const fakeSecret = () => 'generated-secret';

const ciWorkflowSchema = z.object({
  jobs: z.object({ check: z.object({ steps: z.array(z.unknown()) }) }),
});

describe('renderPackageJson', () => {
  const { options, manifest } = fixtureProject();
  const content = renderPackageJson(options, manifest);

  it('renders valid JSON with sorted dependencies and the merged extra fields', () => {
    const packageJson: unknown = JSON.parse(content);

    expect(packageJson).toMatchObject({
      name: 'demo',
      version: '0.0.1',
      private: true,
      type: 'module',
      pnpm: { onlyBuiltDependencies: ['esbuild'] },
    });
    // The fixture declares @nestjs/core before @nestjs/common.
    expect(content.indexOf('"@nestjs/common"')).toBeLessThan(content.indexOf('"@nestjs/core"'));
  });

  it('matches the snapshot', () => {
    expect(content).toMatchSnapshot();
  });

  it('pins the package manager version that launched the installer', () => {
    const pnpmProject = fixtureProject({
      packageManager: 'pnpm',
      packageManagerVersion: '10.12.1',
    });

    const packageJson: unknown = JSON.parse(
      renderPackageJson(pnpmProject.options, pnpmProject.manifest),
    );

    expect(packageJson).toHaveProperty('packageManager', 'pnpm@10.12.1');
  });

  it('leaves npm unpinned', () => {
    expect(JSON.parse(content)).not.toHaveProperty('packageManager');
  });
});

describe('renderEnv / renderEnvExample', () => {
  const { manifest } = fixtureProject();

  it('generates secrets only in .env', () => {
    const env = renderEnv(manifest, fakeSecret);
    const example = renderEnvExample(manifest);

    expect(env).toContain('JWT_SECRET=generated-secret');
    expect(example).toContain('JWT_SECRET=change-me');
    expect(example).not.toContain('generated-secret');
  });

  it('generates a different 48-byte secret for each variable by default', () => {
    const secrets = [...renderEnv(manifest).matchAll(/_SECRET=(.+)/g)].map((match) => match[1]);

    expect(secrets).toHaveLength(2);
    expect(secrets[0]).toMatch(/^[\w-]{64}$/);
    expect(secrets[0]).not.toBe(secrets[1]);
  });

  it('matches the snapshot, grouped by layer', () => {
    expect(renderEnv(manifest, fakeSecret)).toMatchSnapshot();
  });
});

describe('renderDockerCompose', () => {
  it('renders valid YAML with sorted services and named volumes', () => {
    const { options, manifest } = fixtureProject();
    const content = renderDockerCompose(options, manifest);

    expect(parseYaml(content)).toMatchObject({
      services: { mailpit: {}, postgres: {} },
      volumes: { pgdata: {} },
    });
    expect(content).toMatchSnapshot();
  });

  it('runs no API service in the local dev environment', () => {
    const { options, manifest } = fixtureProject();

    expect(parseYaml(renderDockerCompose(options, manifest))).not.toHaveProperty('services.api');
  });

  it('runs the API in a container in the docker dev environment', () => {
    const { options, manifest } = fixtureProject({
      devEnvironment: 'docker',
      packageManager: 'pnpm',
    });

    expect(parseYaml(renderDockerCompose(options, manifest))).toMatchObject({
      services: {
        api: {
          command: [
            'sh',
            '-c',
            'corepack pnpm install && npm run db:migrate && npm run db:seed && npm run start:dev',
          ],
          environment: {
            COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
            DATABASE_URL: 'postgres://app:app@postgres:5432/app',
          },
          volumes: ['.:/app', 'node-modules:/app/node_modules'],
          depends_on: {
            mailpit: { condition: 'service_started' },
            postgres: { condition: 'service_started' },
          },
        },
      },
      volumes: { 'node-modules': {}, pgdata: {} },
    });
  });

  it('runs the front end in a container too in a docker API + web project', () => {
    const { options, manifest } = fixtureProject({
      devEnvironment: 'docker',
      projectType: 'fullstack',
    });

    expect(parseYaml(renderDockerCompose(options, manifest))).toMatchObject({
      services: {
        web: {
          command: ['sh', '-c', 'bun install && bun run dev --host 0.0.0.0'],
          ports: ['5173:5173'],
          volumes: ['./web:/app', 'web-node-modules:/app/node_modules'],
        },
      },
      volumes: { 'web-node-modules': {} },
    });
  });

  it('runs no front end container in a local API + web project', () => {
    const { options, manifest } = fixtureProject({ projectType: 'fullstack' });

    expect(parseYaml(renderDockerCompose(options, manifest))).not.toHaveProperty('services.web');
  });

  it.each([
    ['npm', 'npm install'],
    ['yarn', 'corepack yarn install'],
    ['bun', 'npx --yes bun@1.4.0 install'],
  ] as const)('installs with %s in the dev container', (packageManager, expectedInstall) => {
    const { options, manifest } = fixtureProject({ devEnvironment: 'docker', packageManager });
    const compose = z
      .object({
        services: z.object({
          api: z.object({ command: z.tuple([z.string(), z.string(), z.string()]) }),
        }),
      })
      .parse(parseYaml(renderDockerCompose(options, manifest)));

    expect(compose.services.api.command[2]).toMatch(new RegExp(`^${expectedInstall} && `));
  });
});

describe('renderReadme', () => {
  it('matches the snapshot', () => {
    const { options, manifest } = fixtureProject({ packageManager: 'pnpm' });

    expect(renderReadme(options, manifest)).toMatchSnapshot();
  });

  it.each([
    ['pnpm', 'pnpm db:migrate'],
    ['npm', 'npm run db:migrate'],
    ['yarn', 'yarn db:migrate'],
    ['bun', 'bun run db:migrate'],
  ] as const)('uses %s commands in the quickstart', (packageManager, expectedCommand) => {
    const { options, manifest } = fixtureProject({ packageManager });

    expect(renderReadme(options, manifest)).toContain(`\n${expectedCommand}\n`);
  });

  it('starts the front end from web/ with bun in a local API + web project', () => {
    const { options, manifest } = fixtureProject({
      projectType: 'fullstack',
      packageManager: 'pnpm',
    });

    expect(renderReadme(options, manifest)).toContain('\ncd web\nbun install\nbun run dev\n');
  });

  it('follows both containers in a docker API + web project', () => {
    const { options, manifest } = fixtureProject({
      devEnvironment: 'docker',
      projectType: 'fullstack',
    });
    const readme = renderReadme(options, manifest);

    expect(readme).toContain('\ndocker compose logs -f api web\n');
    expect(readme).not.toContain('\nbun run dev\n');
  });

  it('follows the dev container instead of running the scripts in the docker dev environment', () => {
    const { options, manifest } = fixtureProject({
      devEnvironment: 'docker',
      packageManager: 'pnpm',
    });
    const readme = renderReadme(options, manifest);

    expect(readme).toContain('\ndocker compose up -d\ndocker compose logs -f api\n');
    expect(readme).not.toContain('\npnpm db:migrate\n');
  });
});

describe('renderCiWorkflow', () => {
  it('matches the snapshot for pnpm', () => {
    const { options } = fixtureProject({ packageManager: 'pnpm' });

    expect(renderCiWorkflow(options)).toMatchSnapshot();
  });

  it.each([
    ['npm', 'npm ci', 'npm run test:e2e'],
    ['pnpm', 'pnpm install --frozen-lockfile', 'pnpm test:e2e'],
    ['yarn', 'yarn install --frozen-lockfile', 'yarn test:e2e'],
    ['bun', 'bun install --frozen-lockfile', 'bun run test:e2e'],
  ] as const)(
    'installs and runs the checks with %s',
    (packageManager, expectedInstall, expectedE2e) => {
      const { options } = fixtureProject({ packageManager });

      const workflow: unknown = parseYaml(renderCiWorkflow(options));

      expect(workflow).toMatchObject({
        jobs: {
          check: {
            steps: expect.arrayContaining([{ run: expectedInstall }, { run: expectedE2e }]),
          },
        },
      });
    },
  );

  it('enables Corepack before setting up Node with yarn, so CI runs the yarn the project pins', () => {
    const { options } = fixtureProject({ packageManager: 'yarn' });

    const workflow = ciWorkflowSchema.parse(parseYaml(renderCiWorkflow(options)));

    expect(workflow.jobs.check.steps.slice(0, 3)).toMatchObject([
      { uses: 'actions/checkout@v7' },
      { run: 'corepack enable' },
      { uses: 'actions/setup-node@v7', with: { cache: 'yarn' } },
    ]);
  });

  it('lets pnpm/action-setup read the version from packageManager, which it requires be the only source', () => {
    const { options } = fixtureProject({ packageManager: 'pnpm' });

    const workflow = ciWorkflowSchema.parse(parseYaml(renderCiWorkflow(options)));

    expect(workflow.jobs.check.steps).toContainEqual({ uses: 'pnpm/action-setup@v6' });
  });
});

describe('renderCiWorkflow for the front end', () => {
  const webJobSchema = z.object({
    jobs: z.object({
      web: z.object({ steps: z.array(z.record(z.string(), z.unknown())) }).optional(),
    }),
  });

  it('builds web/ with bun in an API + web project', () => {
    const { options } = fixtureProject({ projectType: 'fullstack', packageManager: 'pnpm' });
    const workflow = webJobSchema.parse(parseYaml(renderCiWorkflow(options)));

    expect(workflow.jobs.web?.steps).toEqual(
      expect.arrayContaining([
        { uses: 'oven-sh/setup-bun@v2' },
        { run: 'bun install --frozen-lockfile' },
        { run: 'bun run generate' },
      ]),
    );
  });

  it('has no front end job in an API project', () => {
    const { options } = fixtureProject();

    expect(webJobSchema.parse(parseYaml(renderCiWorkflow(options))).jobs.web).toBeUndefined();
  });
});
