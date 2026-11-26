import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { exists } from '../support/project.ts';

describe('the CI provider', () => {
  it('is GitHub Actions by default', async () => {
    const projectDir = await generateProject();

    expect(await exists(path.join(projectDir, '.github/workflows/ci.yml'))).toBe(true);
    expect(await exists(path.join(projectDir, '.gitlab-ci.yml'))).toBe(false);
  });

  it('writes .gitlab-ci.yml and no .github folder with --ci gitlab', async () => {
    const projectDir = await generateProject(['--ci', 'gitlab']);

    expect(await exists(path.join(projectDir, '.gitlab-ci.yml'))).toBe(true);
    expect(await exists(path.join(projectDir, '.github'))).toBe(false);
  });

  it('writes no pipeline config with --ci none', async () => {
    const projectDir = await generateProject(['--ci', 'none']);

    expect(await exists(path.join(projectDir, '.gitlab-ci.yml'))).toBe(false);
    expect(await exists(path.join(projectDir, '.github'))).toBe(false);
  });
});
