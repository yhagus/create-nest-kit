import { parseArgs } from 'node:util';
import {
  AUTH_STYLES,
  compatibilityProblem,
  DATABASES,
  ORMS,
  PACKAGE_MANAGERS,
  PLATFORMS,
  VALIDATION_LIBRARIES,
  type ProjectChoices,
} from './options.ts';

/** What the command line asked for. Choices left out are prompted for, or defaulted with --yes. */
export interface CliArgs {
  directory: string | undefined;
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
  platform: { type: 'string' },
  db: { type: 'string' },
  orm: { type: 'string' },
  auth: { type: 'string' },
  validation: { type: 'string' },
  pm: { type: 'string' },
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
    platform: parseChoice('--platform', PLATFORMS, values.platform),
    database: parseChoice('--db', DATABASES, values.db),
    orm: parseChoice('--orm', ORMS, values.orm),
    auth: parseChoice('--auth', AUTH_STYLES, values.auth),
    validation: parseChoice('--validation', VALIDATION_LIBRARIES, values.validation),
    packageManager: parseChoice('--pm', PACKAGE_MANAGERS, values.pm),
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
