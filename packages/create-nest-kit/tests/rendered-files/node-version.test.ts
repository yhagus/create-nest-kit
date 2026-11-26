import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import {
  readJsonFile,
  readPackageJson,
  readProjectFile,
  readYamlFile,
} from '../support/project.ts';

const composeSchema = z.object({
  services: z.object({ api: z.object({ image: z.string() }) }),
});
const enginesSchema = z.object({ engines: z.object({ node: z.string() }) });
const gitlabPipelineSchema = z.object({ check: z.object({ before_script: z.array(z.string()) }) });
const githubWorkflowSchema = z.object({
  jobs: z.object({ check: z.object({ steps: z.array(z.record(z.string(), z.unknown())) }) }),
});

const COREPACK_INSTALL = /npm install --global corepack@(\d+\.\d+\.\d+)/;

/** The corepack version an `npm install --global corepack@X` line installs, or null when none does. */
function corepackVersionIn(text: string): string | null {
  return COREPACK_INSTALL.exec(text)?.[1] ?? null;
}

// .nvmrc and the Dockerfile are copied verbatim (ADR 0001), so they can't read
// PINNED_NODE_VERSION; this keeps them in step with the files rendered from it.
describe('the pinned Node version of a generated project', () => {
  it('is the same exact release in .nvmrc, the Dockerfile, docker-compose.yml and engines.node', async () => {
    const projectDir = await generateProject(['--dev-env', 'docker']);

    const pinnedVersion = (await readProjectFile(projectDir, '.nvmrc')).trim();
    const dockerfile = await readProjectFile(projectDir, 'Dockerfile');
    const compose = composeSchema.parse(await readYamlFile(projectDir, 'docker-compose.yml'));
    const { engines } = enginesSchema.parse(await readJsonFile(projectDir, 'package.json'));

    expect(pinnedVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dockerfile.match(/^FROM node:\S+/gm)).toEqual([
      `FROM node:${pinnedVersion}-alpine`,
      `FROM node:${pinnedVersion}-alpine`,
    ]);
    expect(compose.services.api.image).toBe(`node:${pinnedVersion}-alpine`);
    expect(engines).toEqual({ node: `^${pinnedVersion}` });
  });

  it('types Node with the @types/node of the same major', async () => {
    const projectDir = await generateProject();

    const pinnedMajor = (await readProjectFile(projectDir, '.nvmrc')).trim().split('.')[0];
    const { devDependencies } = await readPackageJson(projectDir);

    expect(devDependencies['@types/node']).toMatch(new RegExp(`^${pinnedMajor}\\.`));
  });
});

// Node 25+ doesn't bundle corepack, so every place that runs pnpm or yarn installs it. The
// Dockerfile can't read COREPACK_VERSION either; this keeps it in step with the rendered CI files.
describe('the corepack version of a generated project', () => {
  it('is the same in the Dockerfile, GitHub Actions and GitLab CI', async () => {
    const githubProjectDir = await generateProject(['--pm', 'yarn', '--ci', 'github']);
    const gitlabProjectDir = await generateProject(['--pm', 'pnpm', '--ci', 'gitlab']);

    const dockerfileVersion = corepackVersionIn(
      await readProjectFile(githubProjectDir, 'Dockerfile'),
    );
    const github = githubWorkflowSchema.parse(
      await readYamlFile(githubProjectDir, '.github/workflows/ci.yml'),
    );
    const gitlab = gitlabPipelineSchema.parse(
      await readYamlFile(gitlabProjectDir, '.gitlab-ci.yml'),
    );

    expect(dockerfileVersion).not.toBeNull();
    expect(corepackVersionIn(JSON.stringify(github.jobs.check.steps))).toBe(dockerfileVersion);
    expect(corepackVersionIn(gitlab.check.before_script.join('\n'))).toBe(dockerfileVersion);
  });
});
