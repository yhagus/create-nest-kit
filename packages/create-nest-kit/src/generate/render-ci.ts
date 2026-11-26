import { stringify } from 'yaml';
import type { PackageManager, ProjectOptions } from '../options.ts';
import { frozenInstallCommand, runScriptCommand } from '../package-manager.ts';
import { WEB_DIRECTORY } from './quickstart.ts';
import { COREPACK_VERSION } from './render-compose.ts';

/** The scripts every CI pipeline runs, in order, after a frozen install. */
export const CHECK_SCRIPTS = ['lint', 'format:check', 'typecheck', 'test'];

export function renderCiWorkflow(options: ProjectOptions): string {
  const packageManager = options.packageManager;
  const workflow = {
    name: 'CI',
    on: { push: { branches: ['main'] }, pull_request: {} },
    jobs: {
      check: {
        'runs-on': 'ubuntu-latest',
        steps: [
          { uses: 'actions/checkout@v7' },
          ...packageManagerSetupSteps(packageManager),
          { run: frozenInstallCommand(packageManager) },
          ...CHECK_SCRIPTS.map((script) => ({ run: runScriptCommand(packageManager, script) })),
        ],
      },
      ...(options.projectType === 'fullstack' && { web: webJob() }),
    },
  };
  return stringify(workflow);
}

/** Builds the front end, which has its own package and always uses bun. */
function webJob(): Record<string, unknown> {
  return {
    'runs-on': 'ubuntu-latest',
    defaults: { run: { 'working-directory': WEB_DIRECTORY } },
    steps: [
      { uses: 'actions/checkout@v7' },
      ...packageManagerSetupSteps('bun'),
      { run: frozenInstallCommand('bun') },
      { run: runScriptCommand('bun', 'generate') },
    ],
  };
}

/** Steps that make `packageManager` and Node available, with dependency caching where setup-node supports it. */
function packageManagerSetupSteps(packageManager: PackageManager): Record<string, unknown>[] {
  switch (packageManager) {
    case 'pnpm':
      // No `version` input: the action reads package.json's packageManager and fails when given both.
      return [{ uses: 'pnpm/action-setup@v6' }, setupNode('pnpm')];
    case 'npm':
      return [setupNode('npm')];
    case 'yarn':
      // Corepack runs the yarn that package.json's packageManager pins (Berry included). Node 25+
      // doesn't bundle it, so it is installed into the pinned Node, which the first setup-node
      // provides. The second only adds the cache: its cache step calls yarn, so it must come last.
      return [
        setupNode(),
        { run: `npm install --global corepack@${COREPACK_VERSION}` },
        { run: 'corepack enable' },
        setupNode('yarn'),
      ];
    case 'bun':
      // Scripts still run their tools with Node; Bun only installs and runs scripts.
      return [{ uses: 'oven-sh/setup-bun@v2' }, setupNode()];
  }
}

/** `cache` names the package manager whose store setup-node caches; Bun is not supported. */
function setupNode(cache?: PackageManager): Record<string, unknown> {
  return {
    uses: 'actions/setup-node@v7',
    with: { 'node-version-file': '.nvmrc', ...(cache && { cache }) },
  };
}
