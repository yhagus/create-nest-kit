// End-to-end tests of install.sh: shellcheck, then the installer in Docker containers against the
// archive in release/ (mounted read-only, downloaded through NEST_KIT_DOWNLOAD_URL=file://...).
// Run with `pnpm test:installer`, which builds and packs first. Needs Docker; shellcheck runs from
// its Docker image when the binary is not installed.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ARCHIVE_NAME, RELEASE_DIR } from './pack-release.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INSTALL_SCRIPT = path.join(ROOT, 'install.sh');
const PACKAGE_JSON = path.join(ROOT, 'packages/create-nest-kit/package.json');

/** Generous: the first run pulls the images. */
const SCENARIO_TIMEOUT_MS = 5 * 60_000;
const NODE_TOO_OLD = 'Node.js 24.15 or newer';
const DOWNLOADING = 'Downloading';
const DRY_RUN_PLAN = 'Layers:\n  base\n  platform/fastify\n';

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs a command, resolving with its exit code instead of rejecting on failure. */
function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = error ? Number(error.code ?? 1) : 0;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

/**
 * Runs `script` with sh in a fresh `image`, with install.sh at /install.sh and release/ at /release,
 * and NEST_KIT_DOWNLOAD_URL pointing at /release.
 */
function runInContainer(image: string, script: string): Promise<CommandResult> {
  return runCommand('docker', [
    'run',
    '--rm',
    '--volume',
    `${INSTALL_SCRIPT}:/install.sh:ro`,
    '--volume',
    `${RELEASE_DIR}:/release:ro`,
    '--env',
    'NEST_KIT_DOWNLOAD_URL=file:///release',
    image,
    'sh',
    '-c',
    script,
  ]);
}

describe('install.sh', () => {
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

    assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  });

  it('(a) node:24: installs and runs the CLI', { timeout: SCENARIO_TIMEOUT_MS }, async () => {
    const result = await runInContainer('node:24', 'sh /install.sh my-api --yes --dry-run');

    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stderr, /Checksum verified/);
    assert.ok(result.stdout.includes(DRY_RUN_PLAN), result.stdout);
  });

  it('(b) node:22: refuses before downloading', { timeout: SCENARIO_TIMEOUT_MS }, async () => {
    const result = await runInContainer('node:22', 'sh /install.sh --yes --dry-run');

    assert.notEqual(result.exitCode, 0);
    assert.ok(result.stderr.includes(NODE_TOO_OLD), result.stderr);
    assert.match(result.stderr, /node {6}v22\./);
    assert.ok(!result.stderr.includes(DOWNLOADING), result.stderr);
  });

  it(
    '(c) no Node.js: refuses with the install hint, before downloading',
    { timeout: SCENARIO_TIMEOUT_MS },
    async () => {
      const result = await runInContainer('debian:stable-slim', 'sh /install.sh --yes --dry-run');

      assert.notEqual(result.exitCode, 0);
      assert.match(result.stderr, /node {6}not found/);
      assert.match(result.stderr, /https:\/\/nodejs\.org.*fnm install 24.*nvm install 24/);
      assert.ok(!result.stderr.includes(DOWNLOADING), result.stderr);
    },
  );

  it(
    '(d) tampered archive: aborts on the checksum mismatch',
    { timeout: SCENARIO_TIMEOUT_MS },
    async () => {
      const result = await runInContainer(
        'node:24',
        [
          'mkdir /tampered',
          'cp /release/* /tampered/',
          `printf x >> /tampered/${ARCHIVE_NAME}`,
          'NEST_KIT_DOWNLOAD_URL=file:///tampered sh /install.sh --yes --dry-run',
        ].join(' && '),
      );

      assert.notEqual(result.exitCode, 0);
      assert.match(result.stderr, /Checksum mismatch/);
      assert.ok(!result.stdout.includes(DRY_RUN_PLAN), result.stdout);
    },
  );

  it('(e) node:24-alpine: runs under busybox sh', { timeout: SCENARIO_TIMEOUT_MS }, async () => {
    // Busybox wget can't read file:// URLs, so the test installs curl; real installs over https
    // work with busybox wget.
    const result = await runInContainer(
      'node:24-alpine',
      'apk add --no-cache --quiet curl && sh /install.sh my-api --yes --dry-run',
    );

    assert.equal(result.exitCode, 0, result.stderr);
    assert.ok(result.stdout.includes(DRY_RUN_PLAN), result.stdout);
  });

  it(
    'the CLI itself refuses an old Node.js with a friendly message',
    { timeout: SCENARIO_TIMEOUT_MS },
    async () => {
      const result = await runInContainer(
        'node:22',
        `mkdir /cli && tar -xzf /release/${ARCHIVE_NAME} -C /cli && node /cli/create-nest-kit/dist/cli.js --version`,
      );

      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /needs Node\.js 24\.15\.0 or newer, but this is Node\.js 22\./);
    },
  );
});

describe('release archive', () => {
  it('runs on its own after extraction, reading its version and templates', async () => {
    const extractDir = await mkdtemp(path.join(os.tmpdir(), 'create-nest-kit-archive-'));
    try {
      await runCommand('tar', ['-xzf', path.join(RELEASE_DIR, ARCHIVE_NAME), '-C', extractDir]);
      const cli = path.join(extractDir, 'create-nest-kit/dist/cli.js');
      const packageJson: unknown = JSON.parse(await readFile(PACKAGE_JSON, 'utf8'));

      const version = await runCommand(process.execPath, [cli, '--version']);
      const dryRun = await runCommand(process.execPath, [cli, 'my-api', '--yes', '--dry-run']);

      assert.ok(
        typeof packageJson === 'object' && packageJson !== null && 'version' in packageJson,
      );
      assert.equal(version.stdout.trim(), packageJson.version);
      assert.equal(dryRun.exitCode, 0, dryRun.stderr);
      assert.match(dryRun.stdout, /\.gitignore +base/);
      assert.match(dryRun.stdout, /drizzle\/meta\/_journal\.json +persistence\/drizzle\/auth-jwt/);
    } finally {
      await rm(extractDir, { recursive: true, force: true });
    }
  });
});
