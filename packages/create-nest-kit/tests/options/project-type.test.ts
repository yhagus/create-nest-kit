import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { exists, listFiles, readPackageJson } from '../support/project.ts';

/** `1.2.3` or `1.2.3-beta.1`: no range, so every install gets the version the matrix tested. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

describe('--type', () => {
  it('api: generates no front end', async () => {
    const projectDir = await generateProject(['--type', 'api']);

    expect(await exists(path.join(projectDir, 'web'))).toBe(false);
  });

  it('fullstack: adds a Nuxt front end in web/, a package of its own', async () => {
    const projectDir = await generateProject(['--type', 'fullstack']);

    expect(await listFiles(path.join(projectDir, 'web'))).toEqual(
      expect.arrayContaining(['.gitignore', 'nuxt.config.ts', 'package.json']),
    );
    expect(await readPackageJson(projectDir, 'web/package.json')).toMatchObject({
      dependencies: { nuxt: expect.stringMatching(EXACT_VERSION) },
    });
  });
});

describe('dependency pins', () => {
  it.each([
    { project: 'the API', file: 'package.json' },
    { project: 'the front end', file: 'web/package.json' },
  ])('pins every dependency of $project to an exact version', async ({ file }) => {
    const projectDir = await generateProject(['--type', 'fullstack']);

    const { dependencies, devDependencies } = await readPackageJson(projectDir, file);
    const rangePins = Object.entries({ ...dependencies, ...devDependencies }).filter(
      ([, version]) => !EXACT_VERSION.test(version),
    );
    expect(rangePins).toEqual([]);
  });
});
