import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { REPO_ROOT } from '../support/paths.ts';
import { prettierCheckFailure } from '../support/prettier.ts';
import { readProjectFile } from '../support/project.ts';

// Every combo is checked through Prettier's API in tests/combos; this runs the real command.

describe('formatting of generated projects', () => {
  it('passes prettier --check in an API + web project', async () => {
    const projectDir = await generateProject(['--type', 'fullstack', '--dev-env', 'docker']);

    expect(await prettierCheckFailure(projectDir)).toBeUndefined();
  });

  it('passes prettier --check with GitLab CI, ignoring the package stores it caches in the project', async () => {
    const projectDir = await generateProject(['--ci', 'gitlab', '--type', 'fullstack']);
    const storeDir = path.join(projectDir, '.ci-cache/npm');
    await mkdir(storeDir, { recursive: true });
    await writeFile(path.join(storeDir, 'unformatted.js'), 'const  x = {a:1}');

    expect(await prettierCheckFailure(projectDir)).toBeUndefined();
  });

  // This repo formats the templates with its root config (`pnpm format`, editors), so the config
  // projects get must not drift from it.
  it("gives projects this repo's Prettier config", async () => {
    const projectDir = await generateProject();
    const repoConfig: unknown = JSON.parse(
      await readFile(path.join(REPO_ROOT, '.prettierrc'), 'utf8'),
    );

    expect(JSON.parse(await readProjectFile(projectDir, '.prettierrc'))).toEqual(repoConfig);
  });
});
