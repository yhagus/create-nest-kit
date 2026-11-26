import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { readJsonFile, readPackageJson } from '../support/project.ts';

describe('package.json', () => {
  it('describes a private ES module package named after the project', async () => {
    const projectDir = await generateProject();

    expect(await readJsonFile(projectDir, 'package.json')).toMatchObject({
      name: 'app',
      version: '0.0.1',
      private: true,
      type: 'module',
      pnpm: { onlyBuiltDependencies: expect.arrayContaining(['@swc/core']) },
    });
  });

  it('has the scripts every combo provides', async () => {
    const projectDir = await generateProject();

    const { scripts } = await readPackageJson(projectDir);
    expect(scripts).toMatchObject({
      build: 'nest build',
      'start:dev': 'nest start --watch',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      lint: 'oxlint src tests',
      'format:check': 'prettier --check .',
      'db:seed': 'nest start --entryFile seed/seed',
    });
  });

  it('lists dependencies in alphabetical order', async () => {
    const projectDir = await generateProject(['--orm', 'mikroorm', '--auth', 'nest']);

    const { dependencies, devDependencies } = await readPackageJson(projectDir);
    expect(Object.keys(dependencies)).toEqual(Object.keys(dependencies).toSorted());
    expect(Object.keys(devDependencies)).toEqual(Object.keys(devDependencies).toSorted());
  });
});
