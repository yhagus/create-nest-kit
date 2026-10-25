import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';
import * as p from '@clack/prompts';
import { parseCliArgs, UsageError, type CliArgs } from './args.ts';
import { formatDryRun } from './dry-run.ts';
import { composeProject, CompositionError, writeProject } from './generate/compose.ts';
import { initGitRepository, installDependencies } from './generate/post.ts';
import { MAILPIT_URL, quickstartCommands } from './generate/quickstart.ts';
import { HELP_TEXT } from './help.ts';
import { describeRun } from './labels.ts';
import { loadLayerSet } from './layers/load.ts';
import { ManifestConflictError } from './layers/merge.ts';
import { plannedLayerIds } from './layers/resolve.ts';
import type { LayerSet } from './layers/types.ts';
import { OptionsError, parseProjectOptions, type ProjectOptions } from './options.ts';
import { installCommand } from './package-manager.ts';
import {
  nonInteractivePackageManager,
  wizardPackageManagerStep,
} from './package-manager-choice.ts';
import { PACKAGE_JSON_PATH } from './paths.ts';
import {
  DEFAULT_DIRECTORY,
  nonInteractivePackageName,
  shellQuote,
  shortenHomePath,
} from './project-target.ts';
import { runWizard } from './wizard.ts';

/** Everything the CLI reads from its process, gathered once in cli.ts. */
export interface RunEnvironment {
  cwd: string;
  /** Written as `~` in the paths we show. */
  homeDir: string;
  /** `npm_config_user_agent`, set by the package manager that launched us. */
  userAgent: string | undefined;
  /** `NEST_KIT_LAYER_SET_MODULE`: replaces the built-in layers (installer tests only). */
  layerSetModule: string | undefined;
}

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

/** Runs the CLI and returns its exit code. Errors meant for the user are printed, not thrown. */
export async function run(argv: readonly string[], environment: RunEnvironment): Promise<number> {
  try {
    return await runCommand(argv, environment);
  } catch (error) {
    printError(error);
    return EXIT_FAILURE;
  }
}

async function runCommand(argv: readonly string[], environment: RunEnvironment): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.showHelp) {
    process.stdout.write(HELP_TEXT);
    return EXIT_SUCCESS;
  }
  if (args.showVersion) {
    process.stdout.write(`${await readOwnVersion()}\n`);
    return EXIT_SUCCESS;
  }

  const isInteractive = !args.acceptDefaults;
  const layerSet = await loadLayerSet(environment.layerSetModule);
  if (isInteractive) p.intro('create-nest-kit');

  const options = await collectOptions(args, environment, layerSet);
  if (!options) return cancelled();

  const planned = plannedLayerIds(options, layerSet.layers);
  if (planned.length > 0) {
    throw new UsageError(
      `This combination is not available yet. Planned layers: ${planned.join(', ')}`,
    );
  }
  const plan = await composeProject(options, layerSet);

  if (args.isDryRun) {
    process.stdout.write(`${formatDryRun(plan)}\n`);
    return EXIT_SUCCESS;
  }

  const targetDir = path.resolve(environment.cwd, options.directory);
  const location = shortenHomePath(targetDir, environment.homeDir);
  if (!(await confirmTargetDirectory(targetDir, location, args))) return cancelled();
  if (isInteractive && !(await confirmSummary(options, location))) return cancelled();

  await writeProject(plan, targetDir);
  p.log.success(`Created ${options.name} in ${location}`);

  if (options.install) await installDependencies(targetDir, options.packageManager);
  if (options.git) await reportGit(targetDir);

  const nextSteps = [
    ...(targetDir === environment.cwd ? [] : [`cd ${shellQuote(options.directory)}`]),
    ...(options.install ? [] : [installCommand(options.packageManager)]),
    ...quickstartCommands(options, plan.manifest),
    `Mailpit (dev mail): ${MAILPIT_URL}`,
  ];
  p.note(nextSteps.join('\n'), 'Next steps');
  p.outro('Happy hacking!');
  return EXIT_SUCCESS;
}

async function collectOptions(
  args: CliArgs,
  environment: RunEnvironment,
  layerSet: LayerSet,
): Promise<ProjectOptions | undefined> {
  const packageManagerFlag = args.choices.packageManager;

  if (args.acceptDefaults) {
    const directory = args.directory ?? DEFAULT_DIRECTORY;
    const { packageManager, version } = nonInteractivePackageManager(
      packageManagerFlag,
      environment.userAgent,
    );
    return parseProjectOptions({
      ...args.choices,
      directory,
      name: nonInteractivePackageName(environment.cwd, directory, args.packageName),
      packageManager,
      packageManagerVersion: version,
    });
  }
  return runWizard({
    cwd: environment.cwd,
    homeDir: environment.homeDir,
    directory: args.directory,
    packageName: args.packageName,
    preset: args.choices,
    packageManager: await wizardPackageManagerStep(packageManagerFlag, environment.userAgent),
    layers: layerSet.layers,
  });
}

/** True when the directory is missing or empty, or the user (or --force) allows writing into it. */
async function confirmTargetDirectory(
  targetDir: string,
  location: string,
  args: CliArgs,
): Promise<boolean> {
  if ((await listDirectory(targetDir)).length === 0 || args.allowNonEmptyDirectory) return true;
  if (args.acceptDefaults) {
    throw new UsageError(
      `${location} is not empty. Pass --force to write into it anyway (files with the same name are replaced; nothing is deleted).`,
    );
  }
  const answer = await p.confirm({
    message: `${location} is not empty. Write into it anyway? Files with the same name are replaced; nothing is deleted.`,
    initialValue: false,
  });
  return answer === true;
}

async function confirmSummary(options: ProjectOptions, location: string): Promise<boolean> {
  const rows = describeRun(options, location);
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  p.note(
    rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`).join('\n'),
    'Summary',
  );
  const answer = await p.confirm({ message: 'Create the project?', initialValue: true });
  return answer === true;
}

async function reportGit(targetDir: string): Promise<void> {
  const result = await initGitRepository(targetDir);
  switch (result.status) {
    case 'committed':
      p.log.success('Initialized a git repository with an initial commit');
      return;
    case 'skipped':
      p.log.info(`Skipped git: ${result.reason}`);
      return;
    case 'not-committed':
      p.log.warn(`Initialized a git repository, but the initial commit failed:\n${result.reason}`);
      return;
  }
}

async function listDirectory(directory: string): Promise<string[]> {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function cancelled(): number {
  p.cancel('Cancelled. Nothing was written.');
  return EXIT_SUCCESS;
}

async function readOwnVersion(): Promise<string> {
  const packageJson: unknown = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  const hasVersion =
    typeof packageJson === 'object' && packageJson !== null && 'version' in packageJson;
  return hasVersion ? String(packageJson.version) : 'unknown';
}

function printError(error: unknown): void {
  const label = styleText('red', 'Error:', { stream: process.stderr });
  process.stderr.write(`${label} ${errorText(error)}\n`);
}

/** Errors the user can act on show their message only; anything else is a bug and shows its stack. */
function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (isUserError(error)) return error.message;
  return error.stack ?? error.message;
}

function isUserError(error: Error): boolean {
  return (
    error instanceof UsageError ||
    error instanceof OptionsError ||
    error instanceof CompositionError ||
    error instanceof ManifestConflictError
  );
}
