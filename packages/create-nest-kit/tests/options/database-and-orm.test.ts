import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateProject } from '../support/cli.ts';
import {
  exists,
  parseEnvFile,
  readPackageJson,
  readProjectFile,
  readYamlFile,
} from '../support/project.ts';

const ORM_PACKAGES = ['drizzle-orm', '@prisma/client', 'typeorm', '@mikro-orm/core', 'mongoose'];

const composeSchema = z.object({ services: z.record(z.string(), z.unknown()) });

async function composeServiceNames(projectDir: string): Promise<string[]> {
  const compose = composeSchema.parse(await readYamlFile(projectDir, 'docker-compose.yml'));
  return Object.keys(compose.services).toSorted();
}

describe('--db postgres with each --orm', () => {
  it.each([
    {
      orm: 'drizzle',
      ormPackage: 'drizzle-orm',
      migrate: 'drizzle-kit migrate',
      configFile: 'drizzle.config.ts',
    },
    {
      orm: 'prisma',
      ormPackage: '@prisma/client',
      migrate: 'prisma migrate deploy',
      configFile: 'prisma/schema/roles.prisma',
    },
    {
      orm: 'typeorm',
      ormPackage: 'typeorm',
      migrate: 'nest build && typeorm migration:run -d dist/database/data-source.js',
      configFile: 'src/database/data-source.ts',
    },
    {
      orm: 'mikroorm',
      ormPackage: '@mikro-orm/core',
      migrate: 'nest build && mikro-orm migration:up',
      configFile: 'src/mikro-orm.config.ts',
    },
  ])(
    '$orm: depends on $ormPackage only, migrates with its tool, and runs PostgreSQL in compose',
    async ({ orm, ormPackage, migrate, configFile }) => {
      const projectDir = await generateProject(['--orm', orm]);

      const { dependencies, scripts } = await readPackageJson(projectDir);
      expect(Object.keys(dependencies).filter((name) => ORM_PACKAGES.includes(name))).toEqual([
        ormPackage,
      ]);
      expect(scripts['db:migrate']).toBe(migrate);
      expect(await exists(path.join(projectDir, configFile))).toBe(true);
      expect(await composeServiceNames(projectDir)).toEqual(['mailpit', 'postgres', 'redis']);
      expect(parseEnvFile(await readProjectFile(projectDir, '.env.example'))).toMatchObject({
        DATABASE_URL: 'postgres://app:app@localhost:5432/app',
      });
    },
  );
});

describe('--db mongodb', () => {
  it('implies Mongoose, runs MongoDB in compose and configures MONGODB_URI', async () => {
    const projectDir = await generateProject(['--db', 'mongodb']);

    const { dependencies, scripts } = await readPackageJson(projectDir);
    expect(Object.keys(dependencies).filter((name) => ORM_PACKAGES.includes(name))).toEqual([
      'mongoose',
    ]);
    expect(scripts).not.toHaveProperty('db:migration:create');
    expect(await composeServiceNames(projectDir)).toEqual(['mailpit', 'mongo', 'redis']);
    const env = parseEnvFile(await readProjectFile(projectDir, '.env.example'));
    expect(env).toMatchObject({
      MONGODB_URI: 'mongodb://localhost:27017/app?directConnection=true',
    });
    expect(env).not.toHaveProperty('DATABASE_URL');
  });
});
