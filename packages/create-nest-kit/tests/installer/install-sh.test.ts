// install.sh end to end: shellcheck, then the installer in Docker containers against the archive in
// release/ (mounted read-only, downloaded through NEST_KIT_DOWNLOAD_URL=file://...), and the default
// version stamped into the release copy, release/install.sh.
// Run with `pnpm test:installer` at the repo root, which builds and packs first. Needs Docker;
// shellcheck runs from its Docker image when the binary is not installed.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import type { CliResult } from '../support/cli.ts';
import { PACKAGE_ROOT, REPO_ROOT } from '../support/paths.ts';
import { readJsonFile } from '../support/project.ts';

const INSTALL_SCRIPT = path.join(REPO_ROOT, 'install.sh');
const RELEASE_DIR = path.join(REPO_ROOT, 'release');
const ARCHIVE_NAME = 'create-nest-kit.tar.gz';

/** Generous: the first run pulls the images. */
const SCENARIO_TIMEOUT_MS = 5 * 60_000;
const NODE_TOO_OLD = 'Node.js 24.15 or newer';
const DOWNLOADING = 'Downloading';
const DRY_RUN_PLAN = 'Layers:\n  base\n  layout/nested\n  platform/fastify\n';

/** Runs a command, resolving with its exit code instead of rejecting on failure. */
function runCommand(command: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

/**
 * Runs `script` with sh in a fresh `image`, with install.sh at /install.sh and release/ at /release,
 * and NEST_KIT_DOWNLOAD_URL pointing at /release. `dockerArgs` go before the image name.
 */
function runInContainer(
  image: string,
  script: string,
  dockerArgs: string[] = [],
): Promise<CliResult> {
  const mounts = [`${INSTALL_SCRIPT}:/install.sh:ro`, `${RELEASE_DIR}:/release:ro`];
  return runCommand('docker', [
    'run',
    '--rm',
    ...dockerArgs,
    ...mounts.flatMap((mount) => ['--volume', mount]),
    '--env',
    'NEST_KIT_DOWNLOAD_URL=file:///release',
    image,
    'sh',
    '-c',
    script,
  ]);
}

async function readPackageVersion(): Promise<string> {
  const packageJson = await readJsonFile(PACKAGE_ROOT, 'package.json');
  return z.object({ version: z.string() }).parse(packageJson).version;
}

describe('install.sh', { timeout: SCENARIO_TIMEOUT_MS }, () => {
  it('passes shellcheck', async () => {
    const hasShellcheck = (await runCommand('shellcheck', ['--version'])).exitCode === 0;
    const result = hasShellcheck
      ? await runCommand('shellcheck', [INSTALL_SCRIPT])
      : await runCommand('docker', [
          'run',
          '--rm',
          '--volume',
          `${INSTALL_SCRIPT}:/install.sh:ro`,
          'koalaman/shellcheck:stable',
          '/install.sh',
        ]);

    expect(result).toMatchObject({ exitCode: 0 });
  });

  it('installs and runs the CLI on node:24', async () => {
    const result = await runInContainer('node:24', 'sh /install.sh my-api --yes --dry-run');

    expect(result).toMatchObject({ exitCode: 0 });
    expect(result.stderr).toMatch(/Checksum verified/);
    expect(result.stdout).toContain(DRY_RUN_PLAN);
  });

  it('refuses node:22 before downloading', async () => {
    const result = await runInContainer('node:22', 'sh /install.sh --yes --dry-run');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(NODE_TOO_OLD);
    expect(result.stderr).toMatch(/node {6}v22\./);
    expect(result.stderr).not.toContain(DOWNLOADING);
  });

  it('refuses a machine without Node.js with the install hint, before downloading', async () => {
    const result = await runInContainer('debian:stable-slim', 'sh /install.sh --yes --dry-run');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/node {6}not found/);
    expect(result.stderr).toMatch(/https:\/\/nodejs\.org.*fnm install 24.*nvm install 24/);
    expect(result.stderr).not.toContain(DOWNLOADING);
  });

  it('aborts on a tampered archive', async () => {
    const result = await runInContainer(
      'node:24',
      [
        'mkdir /tampered',
        'cp /release/* /tampered/',
        `printf x >> /tampered/${ARCHIVE_NAME}`,
        'NEST_KIT_DOWNLOAD_URL=file:///tampered sh /install.sh --yes --dry-run',
      ].join(' && '),
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/Checksum mismatch/);
    expect(result.stdout).not.toContain(DRY_RUN_PLAN);
  });

  it('runs under busybox sh on node:24-alpine', async () => {
    // Busybox wget can't read file:// URLs, so the test installs curl; real installs over https
    // work with busybox wget.
    const result = await runInContainer(
      'node:24-alpine',
      'apk add --no-cache --quiet curl && sh /install.sh my-api --yes --dry-run',
    );

    expect(result).toMatchObject({ exitCode: 0 });
    expect(result.stdout).toContain(DRY_RUN_PLAN);
  });

  it('leaves the CLI itself to refuse an old Node.js with a friendly message', async () => {
    const result = await runInContainer(
      'node:22',
      `mkdir /cli && tar -xzf /release/${ARCHIVE_NAME} -C /cli && node /cli/create-nest-kit/dist/cli.js --version`,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/needs Node\.js 24\.15\.0 or newer, but this is Node\.js 22\./);
  });
});

describe('release/install.sh', { timeout: SCENARIO_TIMEOUT_MS }, () => {
  // Without a network the download fails right after the installer prints the URL it tried.
  const OFFLINE = ['--network', 'none'];
  const RUN_RELEASE_COPY = 'unset NEST_KIT_DOWNLOAD_URL; sh /release/install.sh --yes';

  it('downloads its own release by default', async () => {
    const version = await readPackageVersion();

    const result = await runInContainer('node:24', RUN_RELEASE_COPY, OFFLINE);

    expect(result.stderr).toContain(
      `${DOWNLOADING} https://github.com/yhagus/create-nest-kit/releases/download/v${version}/${ARCHIVE_NAME}`,
    );
  });

  it('downloads NEST_KIT_VERSION when it is set', async () => {
    const result = await runInContainer(
      'node:24',
      `export NEST_KIT_VERSION=v9.9.9; ${RUN_RELEASE_COPY}`,
      OFFLINE,
    );

    expect(result.stderr).toContain('/releases/download/v9.9.9/');
  });
});

describe('the release archive', () => {
  it('runs on its own after extraction, reading its version and templates', async () => {
    const extractDir = await mkdtemp(path.join(os.tmpdir(), 'create-nest-kit-archive-'));
    onTestFinished(() => rm(extractDir, { recursive: true, force: true }));
    await runCommand('tar', ['-xzf', path.join(RELEASE_DIR, ARCHIVE_NAME), '-C', extractDir]);
    const cli = path.join(extractDir, 'create-nest-kit/dist/cli.js');

    const version = await runCommand(process.execPath, [cli, '--version']);
    const dryRun = await runCommand(process.execPath, [cli, 'my-api', '--yes', '--dry-run']);

    expect(version.stdout.trim()).toBe(await readPackageVersion());
    expect(dryRun).toMatchObject({ exitCode: 0 });
    expect(dryRun.stdout).toMatch(/\.gitignore +base/);
    expect(dryRun.stdout).toMatch(/drizzle\/meta\/_journal\.json +persistence\/drizzle\/auth-jwt/);
  });
});
