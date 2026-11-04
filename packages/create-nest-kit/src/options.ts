import { z } from 'zod';
import { DATABASE_LABELS } from './labels.ts';

export const PROJECT_TYPES = ['api', 'fullstack'] as const;
export const PLATFORMS = ['fastify', 'express', 'node'] as const;
export const DATABASES = ['postgres', 'mongodb'] as const;
export const ORMS = ['drizzle', 'prisma', 'typeorm', 'mikroorm', 'mongoose'] as const;
export const AUTH_STYLES = ['jwt', 'nest'] as const;
export const VALIDATION_LIBRARIES = ['zod', 'class-validator', 'valibot', 'arktype'] as const;
export const PATTERNS = ['service', 'cqrs'] as const;
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
export const DEV_ENVIRONMENTS = ['local', 'docker'] as const;

/** `fullstack` adds a Nuxt front end in `web/`, a package of its own. */
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type Database = (typeof DATABASES)[number];
export type Orm = (typeof ORMS)[number];
export type AuthStyle = (typeof AUTH_STYLES)[number];
export type Validation = (typeof VALIDATION_LIBRARIES)[number];
/** How each module is organised: controllers calling services, or commands and queries on buses. */
export type Pattern = (typeof PATTERNS)[number];
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
/** Where the API runs in development: `local` on the host's Node, `docker` in a compose service. */
export type DevEnvironment = (typeof DEV_ENVIRONMENTS)[number];

export const ORMS_BY_DATABASE = {
  postgres: ['drizzle', 'prisma', 'typeorm', 'mikroorm'],
  mongodb: ['mongoose'],
} as const satisfies Record<Database, readonly Orm[]>;

/** Everything the user chooses, apart from where the project goes. */
export interface ProjectChoices {
  projectType: ProjectType;
  platform: Platform;
  database: Database;
  orm: Orm;
  auth: AuthStyle;
  validation: Validation;
  pattern: Pattern;
  emailVerification: boolean;
  csrf: boolean;
  packageManager: PackageManager;
  devEnvironment: DevEnvironment;
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

/**
 * The six choices that change the API's code. Every other option only changes config values, or
 * (the project type) adds a package the API doesn't depend on.
 */
type ComboChoice = 'platform' | 'database' | 'orm' | 'auth' | 'validation' | 'pattern';

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
  projectType: z.enum(PROJECT_TYPES).default('api'),
  platform: z.enum(PLATFORMS).default('fastify'),
  database: z.enum(DATABASES).default('postgres'),
  orm: z.enum(ORMS).optional(),
  auth: z.enum(AUTH_STYLES).default('jwt'),
  validation: z.enum(VALIDATION_LIBRARIES).default('zod'),
  pattern: z.enum(PATTERNS).default('service'),
  emailVerification: z.boolean().default(true),
  csrf: z.boolean().default(true),
  packageManager: z.enum(PACKAGE_MANAGERS).default('npm'),
  packageManagerVersion: z.string().optional(),
  devEnvironment: z.enum(DEV_ENVIRONMENTS).default('local'),
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
  return `${combo.platform}-${combo.database}-${combo.orm}-${combo.auth}-${combo.validation}-${combo.pattern}`;
}

/** All valid platform × persistence × auth × validation × pattern combinations (240). */
export function listCombos(): Combo[] {
  const combos: Combo[] = [];
  for (const platform of PLATFORMS) {
    for (const database of DATABASES) {
      for (const orm of ORMS_BY_DATABASE[database]) {
        for (const auth of AUTH_STYLES) {
          for (const validation of VALIDATION_LIBRARIES) {
            for (const pattern of PATTERNS) {
              const combo = { platform, database, orm, auth, validation, pattern };
              combos.push({ ...combo, id: comboId(combo) });
            }
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
 * from any two of platform, ORM, auth, validation and pattern runs at least once.
 *
 * Each (orm, validation) pair runs once, and 20 is the minimum for that. The (platform, auth)
 * pair rotates by `ormIndex + validationIndex` through the six pairs, listed auth by auth, so any
 * three pairs in a row cover every platform and any four cover both auth styles. Each ORM runs
 * four pairs in a row, and each validation library five, over its five ORMs. The pattern follows
 * the rotation's parity, so any two in a row cover both, and since 2 and 3 are coprime, the six
 * rotations from 0 pair each pattern with each platform.
 */
export function prSubset(): Combo[] {
  return listCombos().filter((combo) => {
    const rotation = ORMS.indexOf(combo.orm) + VALIDATION_LIBRARIES.indexOf(combo.validation);
    const pair = PLATFORM_AUTH_PAIRS[rotation % PLATFORM_AUTH_PAIRS.length];
    return (
      combo.platform === pair?.platform &&
      combo.auth === pair.auth &&
      combo.pattern === PATTERNS[rotation % PATTERNS.length]
    );
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
    pattern: combo.pattern,
  });
}
