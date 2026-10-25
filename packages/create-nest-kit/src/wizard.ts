import * as p from '@clack/prompts';
import { UsageError } from './args.ts';
import {
  AUTH_LABELS,
  DATABASE_LABELS,
  PLATFORM_LABELS,
  VALIDATION_HINTS,
  VALIDATION_LABELS,
} from './labels.ts';
import type { LayerManifest } from './layers/types.ts';
import {
  AUTH_STYLES,
  DATABASES,
  packageNameProblem,
  parseProjectOptions,
  PLATFORMS,
  VALIDATION_LIBRARIES,
  type AuthStyle,
  type Database,
  type Orm,
  type PackageManager,
  type Platform,
  type ProjectChoices,
  type ProjectOptions,
  type Validation,
} from './options.ts';
import type { PackageManagerStep } from './package-manager-choice.ts';
import { DEFAULT_DIRECTORY, packageNameStep, shortenHomePath } from './project-target.ts';
import { comboAvailability, ormStep, selectStep } from './wizard-choices.ts';

export interface WizardInput {
  cwd: string;
  /** Written as `~` when showing where the project goes. */
  homeDir: string;
  directory: string | undefined;
  /** From --name; otherwise the target folder's name, or asked for when that isn't a valid one. */
  packageName: string | undefined;
  /** Choices given as flags; their prompts are skipped. */
  preset: Partial<ProjectChoices>;
  /** Settled from --pm or the launching package manager, or asked for among the installed ones. */
  packageManager: PackageManagerStep;
  layers: readonly LayerManifest[];
}

/** One prompt per answer; a prompt resolves to a symbol when cancelled, which `p.group` strips from its result. */
interface WizardPrompts {
  directory: string | symbol;
  name: string | symbol;
  platform: Platform | symbol;
  database: Database | symbol;
  orm: Orm | symbol;
  auth: AuthStyle | symbol;
  validation: Validation | symbol;
  emailVerification: boolean | symbol;
  csrf: boolean | symbol;
  packageManager: PackageManager | symbol;
  install: boolean | symbol;
  git: boolean | symbol;
}

/** Thrown from clack's onCancel, which otherwise carries on with the next prompt. */
class WizardCancelled extends Error {}

/** Asks for every option not preset. Resolves to undefined when the user cancels. */
export async function runWizard(input: WizardInput): Promise<ProjectOptions | undefined> {
  const { preset, packageManager: packageManagerStep } = input;
  const isAvailable = comboAvailability(input.layers);
  if (!isAvailable(preset)) {
    throw new UsageError('The options given as flags are not available yet (coming soon).');
  }

  try {
    const answers = await p.group<WizardPrompts>(
      {
        directory: () => {
          if (input.directory !== undefined) return Promise.resolve(input.directory);
          p.log.info(`You are in ${shortenHomePath(input.cwd, input.homeDir)}`);
          return p.text({
            message: 'Project name: a new folder here, or . for this folder',
            placeholder: DEFAULT_DIRECTORY,
            defaultValue: DEFAULT_DIRECTORY,
          });
        },
        name: ({ results }) => {
          const directory = results.directory || DEFAULT_DIRECTORY;
          const step = packageNameStep(input.cwd, directory, input.packageName);
          if (step.kind === 'known') return Promise.resolve(step.name);
          p.log.warn(`"${step.folderName}" can't be a package name: ${step.problem}.`);
          return p.text({
            message: 'Package name',
            placeholder: step.suggestion,
            defaultValue: step.suggestion,
            validate: (value) => invalidPackageNameMessage(value || step.suggestion),
          });
        },
        platform: () =>
          preset.platform !== undefined
            ? Promise.resolve(preset.platform)
            : p.select({
                message: 'HTTP platform',
                ...selectStep(PLATFORMS, PLATFORM_LABELS, (platform) => isAvailable({ platform })),
              }),
        database: ({ results }) =>
          preset.database !== undefined
            ? Promise.resolve(preset.database)
            : p.select({
                message: 'Database',
                ...selectStep(DATABASES, DATABASE_LABELS, (database) =>
                  isAvailable({ platform: results.platform, database }),
                ),
              }),
        orm: ({ results }) => {
          if (preset.orm !== undefined) return Promise.resolve(preset.orm);
          const database = results.database ?? 'postgres';
          const step = ormStep(database, (orm) =>
            isAvailable({ platform: results.platform, database, orm }),
          );
          if (step.kind === 'only') {
            p.note(step.note, 'ORM / ODM');
            return Promise.resolve(step.orm);
          }
          return p.select({
            message: 'ORM',
            options: step.options,
            initialValue: step.initialValue,
          });
        },
        auth: ({ results }) =>
          preset.auth !== undefined
            ? Promise.resolve(preset.auth)
            : p.select({
                message: 'Auth style',
                ...selectStep(AUTH_STYLES, AUTH_LABELS, (auth) =>
                  isAvailable({
                    platform: results.platform,
                    database: results.database,
                    orm: results.orm,
                    auth,
                  }),
                ),
              }),
        validation: ({ results }) =>
          preset.validation !== undefined
            ? Promise.resolve(preset.validation)
            : p.select({
                message: 'Validation library',
                ...selectStep(
                  VALIDATION_LIBRARIES,
                  VALIDATION_LABELS,
                  (validation) =>
                    isAvailable({
                      platform: results.platform,
                      database: results.database,
                      orm: results.orm,
                      auth: results.auth,
                      validation,
                    }),
                  VALIDATION_HINTS,
                ),
              }),
        emailVerification: () =>
          preset.emailVerification !== undefined
            ? Promise.resolve(preset.emailVerification)
            : p.confirm({
                message: 'Require email verification before login?',
                initialValue: true,
              }),
        csrf: () =>
          preset.csrf !== undefined
            ? Promise.resolve(preset.csrf)
            : p.confirm({ message: 'Enable CSRF protection?', initialValue: true }),
        packageManager: () =>
          packageManagerStep.kind === 'known'
            ? Promise.resolve(packageManagerStep.packageManager)
            : p.select({
                message: 'Package manager',
                options: packageManagerStep.choices.map(({ name, version }) => ({
                  value: name,
                  label: name,
                  hint: version,
                })),
                initialValue: packageManagerStep.initialValue,
              }),
        install: ({ results }) =>
          preset.install !== undefined
            ? Promise.resolve(preset.install)
            : p.confirm({
                message: `Install dependencies with ${results.packageManager ?? 'npm'}?`,
                initialValue: true,
              }),
        git: () =>
          preset.git !== undefined
            ? Promise.resolve(preset.git)
            : p.confirm({ message: 'Initialize a git repository?', initialValue: true }),
      },
      {
        onCancel: () => {
          throw new WizardCancelled();
        },
      },
    );

    return parseProjectOptions({
      ...answers,
      directory: answers.directory || DEFAULT_DIRECTORY,
      packageManagerVersion: packageManagerVersion(packageManagerStep, answers.packageManager),
    });
  } catch (error) {
    if (error instanceof WizardCancelled) return undefined;
    throw error;
  }
}

function invalidPackageNameMessage(name: string): string | undefined {
  const problem = packageNameProblem(name);
  return problem && `Not a valid npm package name: ${problem}`;
}

/** The version to pin for the chosen manager: from the user agent, or from probing PATH. */
function packageManagerVersion(
  step: PackageManagerStep,
  chosen: PackageManager,
): string | undefined {
  if (step.kind === 'known') return step.version;
  return step.choices.find(({ name }) => name === chosen)?.version;
}
