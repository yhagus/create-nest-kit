import { z } from 'zod';
import { DATABASE_LABELS } from './labels.ts';

export const PLATFORMS = ['fastify', 'express'] as const;
export const DATABASES = ['postgres', 'mongodb'] as const;
export const ORMS = ['drizzle', 'prisma', 'typeorm', 'mikroorm', 'mongoose'] as const;
export const AUTH_STYLES = ['jwt', 'nest'] as const;
export const VALIDATION_LIBRARIES = ['zod', 'class-validator', 'valibot', 'arktype'] as const;
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Database = (typeof DATABASES)[number];
export type Orm = (typeof ORMS)[number];
export type AuthStyle = (typeof AUTH_STYLES)[number];
export type Validation = (typeof VALIDATION_LIBRARIES)[number];
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const ORMS_BY_DATABASE = {
  postgres: ['drizzle', 'prisma', 'typeorm', 'mikroorm'],
  mongodb: ['mongoose'],
} as const satisfies Record<Database, readonly Orm[]>;

/** Everything the user chooses, apart from where the project goes. */
export interface ProjectChoices {
  platform: Platform;
  database: Database;
  orm: Orm;
  auth: AuthStyle;
  validation: Validation;
  emailVerification: boolean;
  csrf: boolean;
  packageManager: PackageManager;
  install: boolean;
  git: boolean;
}

export interface ProjectOptions extends ProjectChoices {
  /** npm package name, also used as the project title. */
  name: string;
  /** Target directory as the user gave it (relative to the working directory, or absolute). */
  directory: string;
  /** Version of `packageManager` when it launched the installer; pinned in package.json. */
  packageManagerVersion?: string;
}

/** The five choices that change generated code. Every other option only changes config values. */
type ComboChoice = 'platform' | 'database' | 'orm' | 'auth' | 'validation';

export type Combo = Pick<ProjectChoices, ComboChoice> & { id: string };

export class OptionsError extends Error {
  override name = 'OptionsError';
}

const MAX_PACKAGE_NAME_LENGTH = 214;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const RESERVED_PACKAGE_NAMES = new Set(['node_modules', 'favicon.ico']);

/** Returns why `name` is not a valid npm package name, or undefined when it is. */
export function packageNameProblem(name: string): string | undefined {
  if (name.length === 0) return 'it is empty';
  if (name.length > MAX_PACKAGE_NAME_LENGTH) {
    return `it is longer than ${MAX_PACKAGE_NAME_LENGTH} characters`;
  }
  if (name !== name.toLowerCase()) return 'it contains capital letters';
  if (name.trim() !== name || /\s/.test(name)) return 'it contains spaces';
  if (RESERVED_PACKAGE_NAMES.has(name)) return 'it is a reserved name';
  if (!PACKAGE_NAME_PATTERN.test(name)) {
    return 'it may only contain lowercase letters, digits and - . _ ~, and must not start with . or _';
  }
  return undefined;
}

const packageNameSchema = z.string().superRefine((name, context) => {
  const problem = packageNameProblem(name);
  if (problem) {
    context.addIssue({
      code: 'custom',
      message: `"${name}" is not a valid npm package name: ${problem}`,
    });
  }
});

/** Validates raw options and fills in defaults. The ORM default depends on the database, so it is applied in `parseProjectOptions`. */
export const projectOptionsSchema = z.object({
  name: packageNameSchema,
  directory: z.string().min(1),
  platform: z.enum(PLATFORMS).default('fastify'),
  database: z.enum(DATABASES).default('postgres'),
  orm: z.enum(ORMS).optional(),
  auth: z.enum(AUTH_STYLES).default('jwt'),
  validation: z.enum(VALIDATION_LIBRARIES).default('zod'),
  emailVerification: z.boolean().default(true),
  csrf: z.boolean().default(true),
  packageManager: z.enum(PACKAGE_MANAGERS).default('npm'),
  packageManagerVersion: z.string().optional(),
  install: z.boolean().default(true),
  git: z.boolean().default(true),
});

export type ProjectOptionsInput = z.input<typeof projectOptionsSchema>;

export function defaultOrmFor(database: Database): Orm {
  return ORMS_BY_DATABASE[database][0];
}

export function isOrmAvailableFor(database: Database, orm: Orm): boolean {
  const available: readonly Orm[] = ORMS_BY_DATABASE[database];
  return available.includes(orm);
}

/** Returns a message with a hint when `orm` cannot be used with `database`, or undefined when it can. */
export function compatibilityProblem(database: Database, orm: Orm): string | undefined {
  if (isOrmAvailableFor(database, orm)) return undefined;

  const databaseLabel = DATABASE_LABELS[database];
  const otherDatabase = DATABASES.find((candidate) => isOrmAvailableFor(candidate, orm));
  const ormHint = `use --orm ${ORMS_BY_DATABASE[database].join(' | ')}`;
  const databaseHint = otherDatabase ? ` or --db ${otherDatabase}` : '';
  return `--orm ${orm} is not available for ${databaseLabel}; ${ormHint}${databaseHint}`;
}

/** Parses raw options, applies defaults and checks that the database and ORM fit together. */
export function parseProjectOptions(input: ProjectOptionsInput): ProjectOptions {
  const result = projectOptionsSchema.safeParse(input);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new OptionsError(messages.join('\n'));
  }

  const { orm, ...rest } = result.data;
  const options = { ...rest, orm: orm ?? defaultOrmFor(rest.database) };
  const problem = compatibilityProblem(options.database, options.orm);
  if (problem) throw new OptionsError(problem);
  return options;
}

export function comboId(combo: Omit<Combo, 'id'>): string {
  return `${combo.platform}-${combo.database}-${combo.orm}-${combo.auth}-${combo.validation}`;
}

/** All valid platform × persistence × auth × validation combinations (80). */
export function listCombos(): Combo[] {
  const combos: Combo[] = [];
  for (const platform of PLATFORMS) {
    for (const database of DATABASES) {
      for (const orm of ORMS_BY_DATABASE[database]) {
        for (const auth of AUTH_STYLES) {
          for (const validation of VALIDATION_LIBRARIES) {
            const combo = { platform, database, orm, auth, validation };
            combos.push({ ...combo, id: comboId(combo) });
          }
        }
      }
    }
  }
  return combos;
}

/** The (platform, auth) pairs `prSubset` rotates through. */
const PLATFORM_AUTH_PAIRS = AUTH_STYLES.flatMap((auth) =>
  PLATFORMS.map((platform) => ({ platform, auth })),
);

/**
 * The 20 combos CI runs on pull requests: a pairwise covering array, so every pair of values
 * from any two of platform, ORM, auth and validation runs at least once.
 *
 * Each (orm, validation) pair runs once, and 20 is the minimum for that. The (platform, auth)
 * pair rotates by `ormIndex + validationIndex`, so along either axis the four pairs come round in
 * turn: each ORM runs all four of them, and so does each validation library over its five ORMs.
 */
export function prSubset(): Combo[] {
  return listCombos().filter((combo) => {
    const rotation = ORMS.indexOf(combo.orm) + VALIDATION_LIBRARIES.indexOf(combo.validation);
    const pair = PLATFORM_AUTH_PAIRS[rotation % PLATFORM_AUTH_PAIRS.length];
    return combo.platform === pair?.platform && combo.auth === pair.auth;
  });
}

/** Full options for a combo, with defaults for everything else. Used to resolve its layers. */
export function optionsForCombo(combo: Combo): ProjectOptions {
  return parseProjectOptions({
    name: combo.id,
    directory: combo.id,
    platform: combo.platform,
    database: combo.database,
    orm: combo.orm,
    auth: combo.auth,
    validation: combo.validation,
  });
}
