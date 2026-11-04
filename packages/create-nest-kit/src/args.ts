import { parseArgs } from 'node:util';
import {
  AUTH_STYLES,
  compatibilityProblem,
  DATABASES,
  DEV_ENVIRONMENTS,
  ORMS,
  packageNameProblem,
  PACKAGE_MANAGERS,
  PATTERNS,
  PLATFORMS,
  PROJECT_TYPES,
  VALIDATION_LIBRARIES,
  type ProjectChoices,
} from './options.ts';

/** What the command line asked for. Choices left out are prompted for, or defaulted with --yes. */
export interface CliArgs {
  directory: string | undefined;
  /** --name: the npm package name, instead of the target folder's name. */
  packageName: string | undefined;
  choices: Partial<ProjectChoices>;
  /** --yes: take defaults for everything not given as a flag, and don't prompt. */
  acceptDefaults: boolean;
  /** --force: write into a non-empty directory without asking. */
  allowNonEmptyDirectory: boolean;
  isDryRun: boolean;
  showHelp: boolean;
  showVersion: boolean;
}

/** A command line we can't act on. The message is shown to the user as is. */
export class UsageError extends Error {
  override name = 'UsageError';
}

const FLAGS = {
  name: { type: 'string' },
  type: { type: 'string' },
  platform: { type: 'string' },
  db: { type: 'string' },
  orm: { type: 'string' },
  auth: { type: 'string' },
  validation: { type: 'string' },
  pattern: { type: 'string' },
  pm: { type: 'string' },
  'dev-env': { type: 'string' },
  'email-verification': { type: 'boolean' },
  csrf: { type: 'boolean' },
  install: { type: 'boolean' },
  git: { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  force: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

export function parseCliArgs(argv: readonly string[]): CliArgs {
  const { values, positionals } = parseFlags(argv);
  if (positionals.length > 1) {
    throw new UsageError(`Expected at most one directory, got: ${positionals.join(' ')}`);
  }

  // Choices not given stay undefined, which both the wizard and the options schema treat as "not chosen".
  const choices: Partial<ProjectChoices> = {
    projectType: parseChoice('--type', PROJECT_TYPES, values.type),
    platform: parseChoice('--platform', PLATFORMS, values.platform),
    database: parseChoice('--db', DATABASES, values.db),
    orm: parseChoice('--orm', ORMS, values.orm),
    auth: parseChoice('--auth', AUTH_STYLES, values.auth),
    validation: parseChoice('--validation', VALIDATION_LIBRARIES, values.validation),
    pattern: parseChoice('--pattern', PATTERNS, values.pattern),
    packageManager: parseChoice('--pm', PACKAGE_MANAGERS, values.pm),
    devEnvironment: parseChoice('--dev-env', DEV_ENVIRONMENTS, values['dev-env']),
    emailVerification: values['email-verification'],
    csrf: values.csrf,
    install: values.install,
    git: values.git,
  };
  if (choices.database && choices.orm) {
    const problem = compatibilityProblem(choices.database, choices.orm);
    if (problem) throw new UsageError(problem);
  }

  return {
    directory: positionals[0],
    packageName: parsePackageName(values.name),
    choices,
    acceptDefaults: values.yes ?? false,
    allowNonEmptyDirectory: values.force ?? false,
    isDryRun: values['dry-run'] ?? false,
    showHelp: values.help ?? false,
    showVersion: values.version ?? false,
  };
}

function parseFlags(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      options: FLAGS,
      allowPositionals: true,
      allowNegative: true,
      strict: true,
    });
  } catch (error) {
    // parseArgs throws TypeErrors with messages written for end users ("Unknown option '--foo'").
    if (error instanceof TypeError) throw new UsageError(error.message, { cause: error });
    throw error;
  }
}

function parsePackageName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const problem = packageNameProblem(value);
  if (problem)
    throw new UsageError(`--name "${value}" is not a valid npm package name: ${problem}`);
  return value;
}

function parseChoice<T extends string>(
  flag: string,
  allowed: readonly T[],
  value: string | undefined,
): T | undefined {
  if (value === undefined) return undefined;
  const choice = allowed.find((candidate) => candidate === value);
  if (choice === undefined) {
    throw new UsageError(`${flag} must be one of ${allowed.join(', ')} (got "${value}")`);
  }
  return choice;
}
