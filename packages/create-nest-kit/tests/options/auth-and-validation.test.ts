import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { readPackageJson } from '../support/project.ts';

const AUTH_PACKAGES = [
  '@nestjs/jwt',
  '@node-rs/argon2',
  '@nestjs/authentication',
  '@nestjs/authorization',
];
const VALIDATION_PACKAGES = ['zod', 'class-validator', 'class-transformer', 'valibot', 'arktype'];

async function dependenciesAmong(projectDir: string, candidates: string[]): Promise<string[]> {
  const { dependencies } = await readPackageJson(projectDir);
  return Object.keys(dependencies)
    .filter((name) => candidates.includes(name))
    .toSorted();
}

describe('--auth', () => {
  it.each([
    { auth: 'jwt', packages: ['@nestjs/jwt', '@node-rs/argon2'] },
    { auth: 'nest', packages: ['@nestjs/authentication', '@nestjs/authorization'] },
  ])('$auth: depends on $packages', async ({ auth, packages }) => {
    const projectDir = await generateProject(['--auth', auth]);

    expect(await dependenciesAmong(projectDir, AUTH_PACKAGES)).toEqual(packages);
  });
});

describe('--validation', () => {
  it.each([
    { validation: 'zod', packages: ['zod'] },
    { validation: 'class-validator', packages: ['class-transformer', 'class-validator'] },
    { validation: 'valibot', packages: ['valibot'] },
    { validation: 'arktype', packages: ['arktype'] },
  ])(
    '$validation: depends on $packages and no other validation library',
    async ({ validation, packages }) => {
      const projectDir = await generateProject(['--validation', validation]);

      expect(await dependenciesAmong(projectDir, VALIDATION_PACKAGES)).toEqual(packages);
    },
  );
});
