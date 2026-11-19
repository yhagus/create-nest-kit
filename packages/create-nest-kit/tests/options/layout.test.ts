import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import { exists, readJsonFile, readProjectFile } from '../support/project.ts';

const tsconfigSchema = z.object({
  compilerOptions: z.object({ paths: z.record(z.string(), z.array(z.string())).optional() }),
});
const nestCliSchema = z.object({
  compilerOptions: z.object({ assets: z.array(z.object({ include: z.string() })) }),
});

async function readTsconfigPaths(projectDir: string) {
  return tsconfigSchema.parse(await readJsonFile(projectDir, 'tsconfig.json')).compilerOptions
    .paths;
}

async function readNestAssets(projectDir: string): Promise<string[]> {
  const nestCli = nestCliSchema.parse(await readJsonFile(projectDir, 'nest-cli.json'));
  return nestCli.compilerOptions.assets.map((asset) => asset.include);
}

describe('--layout nested', () => {
  it('groups modules under src/modules, src/common and src/infra, imported relatively', async () => {
    const projectDir = await generateProject(['--layout', 'nested']);

    expect(await exists(path.join(projectDir, 'src/modules/users/users.module.ts'))).toBe(true);
    expect(await exists(path.join(projectDir, 'src/common/pagination.ts'))).toBe(true);
    expect(await exists(path.join(projectDir, 'src/infra/mail/mail.module.ts'))).toBe(true);
    expect(await readProjectFile(projectDir, 'src/modules/users/users.service.ts')).toContain(
      "from '../../common/pagination.js'",
    );
    expect(await readTsconfigPaths(projectDir)).toBeUndefined();
    expect(await readNestAssets(projectDir)).toEqual(['infra/mail/templates/**/*.html']);
  });
});

describe('--layout flat', () => {
  it('puts each module in src/<module> and shared code in src/libs', async () => {
    const projectDir = await generateProject(['--layout', 'flat']);

    expect(await exists(path.join(projectDir, 'src/users/users.module.ts'))).toBe(true);
    expect(await exists(path.join(projectDir, 'src/libs/pagination.ts'))).toBe(true);
    expect(await exists(path.join(projectDir, 'src/mail/mail.module.ts'))).toBe(true);
    expect(await exists(path.join(projectDir, 'src/modules'))).toBe(false);
    expect(await readNestAssets(projectDir)).toEqual(['mail/templates/**/*.html']);
  });

  it('imports other modules through @/ and its own files relatively, with @/ mapped to src/', async () => {
    const projectDir = await generateProject(['--layout', 'flat']);

    const usersService = await readProjectFile(projectDir, 'src/users/users.service.ts');
    expect(usersService).toContain("from '@/libs/pagination.js'");
    expect(usersService).toContain("from '@/sessions/sessions.service.js'");
    expect(usersService).toContain("from './users.repository.js'");
    expect(await readTsconfigPaths(projectDir)).toEqual({
      '@/*': [expect.stringMatching(/^\.\/src\/\*$/)],
    });
    expect(await readProjectFile(projectDir, 'vitest.config.ts')).toContain(
      'resolve: { tsconfigPaths: true }',
    );
  });
});
