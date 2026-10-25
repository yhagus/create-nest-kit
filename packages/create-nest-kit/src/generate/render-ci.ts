import { stringify } from 'yaml';
import type { PackageManager, ProjectOptions } from '../options.ts';
import { frozenInstallCommand, runScriptCommand } from '../package-manager.ts';

const NODE_VERSION = 24;
const CHECK_SCRIPTS = ['lint', 'format:check', 'typecheck', 'test', 'test:e2e'];

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
    },
  };
  return stringify(workflow);
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
      // Corepack runs the yarn that package.json's packageManager pins (Berry included).
      // It must be on before setup-node, whose cache step calls yarn.
      return [{ run: 'corepack enable' }, setupNode('yarn')];
    case 'bun':
      // Scripts still run their tools with Node; Bun only installs and runs scripts.
      return [{ uses: 'oven-sh/setup-bun@v2' }, setupNode()];
  }
}

/** `cache` names the package manager whose store setup-node caches; Bun is not supported. */
function setupNode(cache?: PackageManager): Record<string, unknown> {
  return {
    uses: 'actions/setup-node@v7',
    with: { 'node-version': NODE_VERSION, ...(cache && { cache }) },
  };
}
