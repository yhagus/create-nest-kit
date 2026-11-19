import { describe, expect, it } from 'vitest';
import {
  AUTH_STYLES,
  listCombos,
  OptionsError,
  LAYOUTS,
  ORMS,
  PATTERNS,
  parseProjectOptions,
  PLATFORMS,
  prSubset,
  VALIDATION_LIBRARIES,
  type Combo,
} from '../src/options.ts';

describe('parseProjectOptions', () => {
  it('fills in the documented defaults', () => {
    expect(parseProjectOptions({ name: 'api', directory: 'api' })).toEqual({
      name: 'api',
      directory: 'api',
      projectType: 'api',
      platform: 'fastify',
      database: 'postgres',
      orm: 'drizzle',
      auth: 'jwt',
      validation: 'zod',
      pattern: 'service',
      layout: 'nested',
      emailVerification: true,
      csrf: true,
      packageManager: 'npm',
      devEnvironment: 'local',
      install: true,
      git: true,
    });
  });

  it('defaults the ORM to mongoose for MongoDB', () => {
    expect(parseProjectOptions({ name: 'api', directory: 'api', database: 'mongodb' }).orm).toBe(
      'mongoose',
    );
  });

  it('rejects a SQL ORM on MongoDB with a hint', () => {
    expect(() =>
      parseProjectOptions({ name: 'api', directory: 'api', database: 'mongodb', orm: 'drizzle' }),
    ).toThrow(
      new OptionsError(
        '--orm drizzle is not available for MongoDB; use --orm mongoose or --db postgres',
      ),
    );
  });

  it('rejects mongoose on PostgreSQL and suggests both ways out', () => {
    expect(() => parseProjectOptions({ name: 'api', directory: 'api', orm: 'mongoose' })).toThrow(
      '--orm mongoose is not available for PostgreSQL; use --orm drizzle | prisma | typeorm | mikroorm or --db mongodb',
    );
  });

  it.each([
    ['My-Api', 'capital letters'],
    ['my api', 'spaces'],
    ['.hidden', 'must not start with'],
    ['node_modules', 'reserved'],
  ])('rejects the package name %j', (name, reason) => {
    expect(() => parseProjectOptions({ name, directory: 'x' })).toThrow(reason);
  });

  it('accepts a scoped package name', () => {
    expect(parseProjectOptions({ name: '@acme/api', directory: 'x' }).name).toBe('@acme/api');
  });
});

describe('listCombos', () => {
  it('lists the 480 valid combinations with unique ids', () => {
    const ids = listCombos().map((combo) => combo.id);

    expect(new Set(ids).size).toBe(480);
    expect(ids).toContain('fastify-postgres-drizzle-jwt-zod-service-nested');
    expect(ids).toContain('express-mongodb-mongoose-nest-arktype-cqrs-flat');
    expect(ids).toContain('node-postgres-prisma-jwt-valibot-service-flat');
    expect(ids.filter((id) => id.startsWith('fastify-mongodb-mongoose-jwt-zod-'))).toEqual([
      'fastify-mongodb-mongoose-jwt-zod-service-nested',
      'fastify-mongodb-mongoose-jwt-zod-service-flat',
      'fastify-mongodb-mongoose-jwt-zod-cqrs-nested',
      'fastify-mongodb-mongoose-jwt-zod-cqrs-flat',
    ]);
  });
});

/** The dimensions the PR subset must cover pairwise. The database follows from the ORM. */
const DIMENSIONS = {
  platform: PLATFORMS,
  orm: ORMS,
  auth: AUTH_STYLES,
  validation: VALIDATION_LIBRARIES,
  pattern: PATTERNS,
  layout: LAYOUTS,
} as const;
type Dimension = keyof typeof DIMENSIONS;

/** Every `<a>/<b>` value pair of two dimensions that no combo in `combos` contains. */
function missingPairs(combos: readonly Combo[], first: Dimension, second: Dimension): string[] {
  const covered = new Set(combos.map((combo) => `${combo[first]}/${combo[second]}`));
  const allPairs = DIMENSIONS[first].flatMap((a) =>
    DIMENSIONS[second].map((b): string => `${a}/${b}`),
  );
  return allPairs.filter((pair) => !covered.has(pair));
}

describe('prSubset', () => {
  const subset = prSubset();

  it('picks 20 combos, the minimum for every (orm, validation) pair', () => {
    expect(subset).toHaveLength(20);
  });

  it.each([
    ['platform', 'orm'],
    ['platform', 'auth'],
    ['platform', 'validation'],
    ['orm', 'auth'],
    ['orm', 'validation'],
    ['auth', 'validation'],
    ['pattern', 'platform'],
    ['pattern', 'orm'],
    ['pattern', 'auth'],
    ['pattern', 'validation'],
    ['layout', 'platform'],
    ['layout', 'orm'],
    ['layout', 'auth'],
    ['layout', 'validation'],
    ['layout', 'pattern'],
  ] as const)('covers every (%s, %s) pair', (first, second) => {
    expect(missingPairs(subset, first, second)).toEqual([]);
  });

  // Validation libraries become ready one at a time, so each one's slice must stand on its own.
  // Its five combos can't hold all six (platform, auth) pairs, but they hold every value of both.
  it.each(VALIDATION_LIBRARIES)(
    'runs every platform, auth style, pattern and layout within the %s combos',
    (validation) => {
      const combosOfLibrary = subset.filter((combo) => combo.validation === validation);

      expect(new Set(combosOfLibrary.map((combo) => combo.platform))).toEqual(new Set(PLATFORMS));
      expect(new Set(combosOfLibrary.map((combo) => combo.auth))).toEqual(new Set(AUTH_STYLES));
      expect(new Set(combosOfLibrary.map((combo) => combo.pattern))).toEqual(new Set(PATTERNS));
      expect(new Set(combosOfLibrary.map((combo) => combo.layout))).toEqual(new Set(LAYOUTS));
    },
  );
});
