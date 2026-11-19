import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { readPackageJson, readProjectFile } from '../support/project.ts';

const PLATFORM_PACKAGES = [
  '@nestjs/platform-fastify',
  '@nestjs/platform-express',
  '@nestjs/platform-node',
];

describe('--platform', () => {
  it.each([
    {
      platform: 'fastify',
      platformPackage: '@nestjs/platform-fastify',
      appType: 'NestFastifyApplication',
    },
    {
      platform: 'express',
      platformPackage: '@nestjs/platform-express',
      appType: 'NestExpressApplication',
    },
    { platform: 'node', platformPackage: '@nestjs/platform-node', appType: 'NestNodeApplication' },
  ])(
    '$platform: depends on $platformPackage only, and creates a $appType',
    async ({ platform, platformPackage, appType }) => {
      const projectDir = await generateProject(['--platform', platform]);

      const { dependencies } = await readPackageJson(projectDir);
      const platformDependencies = Object.keys(dependencies).filter((name) =>
        PLATFORM_PACKAGES.includes(name),
      );
      expect(platformDependencies).toEqual([platformPackage]);
      expect(await readProjectFile(projectDir, 'src/bootstrap/create-app.ts')).toContain(appType);
    },
  );
});
