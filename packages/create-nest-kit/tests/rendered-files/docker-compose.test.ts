import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import { readYamlFile } from '../support/project.ts';

const composeSchema = z.object({
  services: z.record(
    z.string(),
    z.object({
      command: z.array(z.string()).optional(),
      environment: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

async function readCompose(args: string[]): Promise<unknown> {
  return readYamlFile(await generateProject(args), 'docker-compose.yml');
}

/** The hosts of the URLs compose hands the API container. */
function containerUrlHosts(compose: z.infer<typeof composeSchema>): string[] {
  return Object.values(compose.services.api?.environment ?? {})
    .filter((value) => /^[a-z]+:\/\//.test(value))
    .map((value) => new URL(value).hostname);
}

describe('docker-compose.yml with --dev-env local', () => {
  it('runs only the backing services: no API and no front end container', async () => {
    const compose = await readCompose(['--dev-env', 'local', '--type', 'fullstack']);

    expect(compose).toMatchObject({ services: { mailpit: {}, postgres: {}, redis: {} } });
    expect(compose).not.toHaveProperty('services.api');
    expect(compose).not.toHaveProperty('services.web');
  });
});

describe('docker-compose.yml with --dev-env docker', () => {
  it('runs the API from a mount: install, migrate, seed, then start:dev', async () => {
    const compose = await readCompose(['--dev-env', 'docker', '--pm', 'pnpm']);

    expect(compose).toMatchObject({
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
          depends_on: { postgres: {}, redis: {}, mailpit: {} },
        },
      },
      volumes: { 'node-modules': {} },
    });
  });

  it.each([
    { packageManager: 'npm', install: 'npm install' },
    { packageManager: 'yarn', install: 'corepack yarn install' },
    { packageManager: 'bun', install: 'npx --yes bun@1.4.0 install' },
  ])('installs with $packageManager in the API container', async ({ packageManager, install }) => {
    const compose = composeSchema.parse(
      await readCompose(['--dev-env', 'docker', '--pm', packageManager]),
    );

    expect(compose.services.api?.command?.[2]).toMatch(new RegExp(`^${install} && `));
  });

  it.each(['postgres', 'mongodb'])(
    'points every URL of the API container at a compose service (%s)',
    async (database) => {
      const compose = composeSchema.parse(
        await readCompose(['--dev-env', 'docker', '--db', database]),
      );

      const hosts = containerUrlHosts(compose);
      expect(hosts.length).toBeGreaterThan(0);
      expect(Object.keys(compose.services)).toEqual(expect.arrayContaining(hosts));
    },
  );

  it('runs the front end in a container too in an API + web project', async () => {
    const compose = await readCompose(['--dev-env', 'docker', '--type', 'fullstack']);

    expect(compose).toMatchObject({
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
});
