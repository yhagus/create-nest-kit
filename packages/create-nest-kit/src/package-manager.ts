import { PACKAGE_MANAGERS, type PackageManager } from './options.ts';

/**
 * Detects the package manager that launched us from `npm_config_user_agent`
 * (e.g. `pnpm/10.12.1 npm/? node/v24.15.0 darwin arm64`). Undefined when none of ours did,
 * e.g. when install.sh runs the CLI with plain `node`.
 */
export function detectPackageManager(userAgent: string | undefined): PackageManager | undefined {
  const name = userAgent?.split('/')[0];
  return PACKAGE_MANAGERS.find((candidate) => candidate === name);
}

/** `<major>.<minor>.<patch>` with an optional prerelease. Anything else is not trusted as a version. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isExactVersion(text: string): boolean {
  return VERSION_PATTERN.test(text);
}

/**
 * The version of `packageManager` from `npm_config_user_agent`, when that package manager is the
 * one that launched us (`pnpm/10.12.1 npm/? ...` gives `10.12.1` for pnpm). Undefined otherwise.
 */
export function detectPackageManagerVersion(
  userAgent: string | undefined,
  packageManager: PackageManager,
): string | undefined {
  const [launcher = ''] = userAgent?.split(' ') ?? [];
  const [name, version] = launcher.split('/');
  if (name !== packageManager || version === undefined) return undefined;
  return isExactVersion(version) ? version : undefined;
}

/**
 * Versions generated projects are tested with, pinned when the user's own version is unknown.
 * Without a pin, corepack picks the newest release (pnpm 11+ rejects dependencies published in the
 * last 24 hours by default).
 */
const TESTED_VERSIONS = { pnpm: '10.34.8', yarn: '1.22.22' } as const;

/**
 * package.json's `packageManager` value, which corepack, pnpm/action-setup and the Dockerfile read.
 * Only pnpm and yarn get one: corepack doesn't manage npm or bun.
 */
export function packageManagerPin(
  packageManager: PackageManager,
  detectedVersion: string | undefined,
): string | undefined {
  if (packageManager !== 'pnpm' && packageManager !== 'yarn') return undefined;
  return `${packageManager}@${detectedVersion ?? TESTED_VERSIONS[packageManager]}`;
}

/** The shortest way to run a package.json script: `pnpm x`, `npm run x`, `yarn x`, `bun run x`. */
export function runScriptCommand(packageManager: PackageManager, script: string): string {
  const needsRun = packageManager === 'npm' || packageManager === 'bun';
  return needsRun ? `${packageManager} run ${script}` : `${packageManager} ${script}`;
}

export function installCommand(packageManager: PackageManager): string {
  return `${packageManager} install`;
}

/** Install that fails instead of updating the lockfile, for CI. */
export function frozenInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'npm':
      return 'npm ci';
    case 'pnpm':
      return 'pnpm install --frozen-lockfile';
    case 'yarn':
      // Yarn classic ignores --immutable, so it would not fail on an outdated lockfile.
      // Berry accepts --frozen-lockfile as a deprecated alias of --immutable (its default on CI anyway).
      return 'yarn install --frozen-lockfile';
    case 'bun':
      return 'bun install --frozen-lockfile';
  }
}
