import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nonInteractivePackageManager,
  probeInstalledPackageManagers,
  wizardPackageManagerStep,
  type InstalledPackageManager,
} from '../src/package-manager-choice.ts';

const PNPM_LAUNCHED = 'pnpm/10.12.1 npm/? node/v24.15.0 darwin arm64';

const PNPM_NPM_AND_BUN: InstalledPackageManager[] = [
  { name: 'pnpm', version: '10.20.0' },
  { name: 'npm', version: '11.4.2' },
  { name: 'bun', version: '1.3.0' },
];

function probeFinding(installed: InstalledPackageManager[]) {
  return () => Promise.resolve(installed);
}

describe('wizardPackageManagerStep', () => {
  it('uses --pm, with the version from the user agent when that manager launched us', async () => {
    const step = await wizardPackageManagerStep(
      'pnpm',
      PNPM_LAUNCHED,
      probeFinding(PNPM_NPM_AND_BUN),
    );

    expect(step).toEqual({ kind: 'known', packageManager: 'pnpm', version: '10.12.1' });
  });

  it('uses the package manager that launched us', async () => {
    const step = await wizardPackageManagerStep(
      undefined,
      PNPM_LAUNCHED,
      probeFinding(PNPM_NPM_AND_BUN),
    );

    expect(step).toEqual({ kind: 'known', packageManager: 'pnpm', version: '10.12.1' });
  });

  it('asks among the installed managers, pnpm preselected, when nothing launched us', async () => {
    const step = await wizardPackageManagerStep(
      undefined,
      undefined,
      probeFinding(PNPM_NPM_AND_BUN),
    );

    expect(step).toEqual({ kind: 'ask', choices: PNPM_NPM_AND_BUN, initialValue: 'pnpm' });
  });

  it('preselects npm when pnpm is not installed', async () => {
    const npmAndYarn: InstalledPackageManager[] = [
      { name: 'npm', version: '11.4.2' },
      { name: 'yarn', version: '1.22.22' },
    ];

    const step = await wizardPackageManagerStep(undefined, undefined, probeFinding(npmAndYarn));

    expect(step).toEqual({ kind: 'ask', choices: npmAndYarn, initialValue: 'npm' });
  });

  it('treats a user agent naming no supported manager as nothing having launched us', async () => {
    const step = await wizardPackageManagerStep(
      undefined,
      'deno/2.4.0 npm/? deno/2.4.0 linux x64',
      probeFinding(PNPM_NPM_AND_BUN),
    );

    expect(step).toMatchObject({ kind: 'ask' });
  });

  it('uses the only installed manager without asking, with its probed version', async () => {
    const step = await wizardPackageManagerStep(
      undefined,
      undefined,
      probeFinding([{ name: 'yarn', version: '4.9.1' }]),
    );

    expect(step).toEqual({ kind: 'known', packageManager: 'yarn', version: '4.9.1' });
  });

  it('falls back to npm when no manager is found', async () => {
    const step = await wizardPackageManagerStep(undefined, undefined, probeFinding([]));

    expect(step).toEqual({ kind: 'known', packageManager: 'npm', version: undefined });
  });
});

describe('nonInteractivePackageManager', () => {
  it('uses npm when nothing launched us', () => {
    expect(nonInteractivePackageManager(undefined, undefined)).toEqual({
      packageManager: 'npm',
      version: undefined,
    });
  });

  it('uses the package manager that launched us', () => {
    expect(nonInteractivePackageManager(undefined, PNPM_LAUNCHED)).toEqual({
      packageManager: 'pnpm',
      version: '10.12.1',
    });
  });
});

describe.skipIf(process.platform === 'win32')('probeInstalledPackageManagers', () => {
  let binDir: string;

  beforeEach(async () => {
    binDir = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-probe-'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(binDir, { recursive: true, force: true });
  });

  async function fakeCommand(name: string, output: string): Promise<void> {
    const file = path.join(binDir, name);
    await writeFile(file, `#!/bin/sh\necho '${output}'\n`);
    await chmod(file, 0o755);
  }

  it('lists the managers on PATH in prompt order, keeping only versions that look like versions', async () => {
    await fakeCommand('yarn', '4.9.1');
    await fakeCommand('pnpm', 'pnpm is weird today');
    vi.stubEnv('PATH', binDir);

    const installed = await probeInstalledPackageManagers();

    expect(installed).toEqual([
      { name: 'pnpm', version: undefined },
      { name: 'yarn', version: '4.9.1' },
    ]);
  });
});
