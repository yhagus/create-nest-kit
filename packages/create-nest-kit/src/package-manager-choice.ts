import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PACKAGE_MANAGERS, type PackageManager } from './options.ts';
import {
  detectPackageManager,
  detectPackageManagerVersion,
  isExactVersion,
} from './package-manager.ts';

const execFileAsync = promisify(execFile);

/** A package manager found on PATH. `version` is undefined when `--version` printed something odd. */
export interface InstalledPackageManager {
  name: PackageManager;
  version: string | undefined;
}

/** A package manager settled without asking, with its version when we know it. */
export interface KnownPackageManager {
  packageManager: PackageManager;
  version: string | undefined;
}

/** Settled without asking, or a "Package manager" prompt for the wizard. */
export type PackageManagerStep =
  | ({ kind: 'known' } & KnownPackageManager)
  | {
      kind: 'ask';
      choices: readonly InstalledPackageManager[];
      initialValue: PackageManager;
    };

/** Used with --yes when nothing tells us which manager to use; the default choice after pnpm. */
const FALLBACK_PACKAGE_MANAGER: PackageManager = 'npm';
const PREFERRED_PACKAGE_MANAGER: PackageManager = 'pnpm';

/**
 * `--pm`, else the package manager that launched us (from `npm_config_user_agent`). Undefined when
 * neither tells, which is the case under install.sh.
 */
function requestedPackageManager(
  flag: PackageManager | undefined,
  userAgent: string | undefined,
): KnownPackageManager | undefined {
  const packageManager = flag ?? detectPackageManager(userAgent);
  if (packageManager === undefined) return undefined;
  return { packageManager, version: detectPackageManagerVersion(userAgent, packageManager) };
}

/** The package manager for --yes: the requested one, else npm. */
export function nonInteractivePackageManager(
  flag: PackageManager | undefined,
  userAgent: string | undefined,
): KnownPackageManager {
  return (
    requestedPackageManager(flag, userAgent) ?? {
      packageManager: FALLBACK_PACKAGE_MANAGER,
      version: undefined,
    }
  );
}

/**
 * The wizard's package manager: the requested one, else a prompt among the installed ones (pnpm
 * preselected when installed, else npm). Probes PATH only when it has to ask.
 */
export async function wizardPackageManagerStep(
  flag: PackageManager | undefined,
  userAgent: string | undefined,
  probeInstalled: () => Promise<InstalledPackageManager[]> = probeInstalledPackageManagers,
): Promise<PackageManagerStep> {
  const requested = requestedPackageManager(flag, userAgent);
  if (requested !== undefined) return { kind: 'known', ...requested };

  const installed = await probeInstalled();
  const [firstInstalled, ...otherInstalled] = installed;
  // With none installed, npm's install step will say what's wrong.
  if (firstInstalled === undefined) {
    return { kind: 'known', packageManager: FALLBACK_PACKAGE_MANAGER, version: undefined };
  }
  // With one there is nothing to choose.
  if (otherInstalled.length === 0) {
    return { kind: 'known', packageManager: firstInstalled.name, version: firstInstalled.version };
  }
  const isInstalled = (name: PackageManager) => installed.some((found) => found.name === name);
  const initialValue = [PREFERRED_PACKAGE_MANAGER, FALLBACK_PACKAGE_MANAGER].find(isInstalled);
  return { kind: 'ask', choices: installed, initialValue: initialValue ?? firstInstalled.name };
}

/** A hung `--version` (e.g. corepack asking to download) must not stall the wizard. */
const PROBE_TIMEOUT_MS = 5000;

/** Runs `<name> --version` for every supported manager, in parallel. Keeps the order of PACKAGE_MANAGERS. */
export async function probeInstalledPackageManagers(): Promise<InstalledPackageManager[]> {
  const probed = await Promise.all(PACKAGE_MANAGERS.map(probePackageManager));
  return probed.filter((found) => found !== undefined);
}

async function probePackageManager(
  name: PackageManager,
): Promise<InstalledPackageManager | undefined> {
  try {
    // npm, pnpm and yarn are .cmd shims on Windows, which Node only runs through a shell.
    // The command is built from a fixed package manager name, never from user text.
    const { stdout } =
      process.platform === 'win32'
        ? await execFileAsync(`${name} --version`, { shell: true, timeout: PROBE_TIMEOUT_MS })
        : await execFileAsync(name, ['--version'], { timeout: PROBE_TIMEOUT_MS });
    const version = stdout.trim();
    return { name, version: isExactVersion(version) ? version : undefined };
  } catch {
    // Not on PATH, or not working: either way it is not offered.
    return undefined;
  }
}
