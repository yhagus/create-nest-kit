// Boots one generated project in Docker and checks it answers: /health, then a sign-in as the
// admin db:seed creates. What the matrix can't cover, since it runs every step on the host:
//   node scripts/smoke.ts image [CLI flags]  the production image (Dockerfile), against compose's services
//   node scripts/smoke.ts dev [CLI flags]    `--dev-env docker`'s containers, and web/ with --type fullstack
// Builds nothing: run `pnpm build` first. Needs Docker. SMOKE_DIR (default: <os tmpdir>/create-nest-kit-smoke)
// holds the project; SMOKE_PORT (default: 3000) is the API's port.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseCliArgs } from '../packages/create-nest-kit/src/args.ts';
import { mergeManifests } from '../packages/create-nest-kit/src/layers/merge.ts';
import { LAYERS } from '../packages/create-nest-kit/src/layers/registry.ts';
import { resolveLayers } from '../packages/create-nest-kit/src/layers/resolve.ts';
import { parseProjectOptions } from '../packages/create-nest-kit/src/options.ts';

type Mode = 'image' | 'dev';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CLI_PATH = path.join(ROOT, 'packages/create-nest-kit/dist/cli.js');
const SMOKE_DIR = process.env.SMOKE_DIR ?? path.join(os.tmpdir(), 'create-nest-kit-smoke');
const PORT = process.env.SMOKE_PORT ?? '3000';
const WEB_URL = 'http://localhost:5173/';
/** First starts install dependencies in the containers, and pull images. */
const BOOT_TIMEOUT_MS = 8 * 60_000;
const POLL_INTERVAL_MS = 3000;

// The CLI pins the package manager that launched it; under `pnpm smoke` that would always be pnpm.
delete process.env.npm_config_user_agent;

const [modeArg, ...cliFlags] = process.argv.slice(2);
if (modeArg !== 'image' && modeArg !== 'dev') {
  console.error('Usage: node scripts/smoke.ts <image|dev> [create-nest-kit flags]');
  process.exit(2);
}
const mode: Mode = modeArg;
const name = `smoke-${mode}`;
const options = parseProjectOptions({ ...parseCliArgs(cliFlags).choices, name, directory: name });
const projectDir = path.join(SMOKE_DIR, name);
const logPath = path.join(SMOKE_DIR, `${name}.log`);

await mkdir(SMOKE_DIR, { recursive: true });
await rm(projectDir, { recursive: true, force: true });
const log = createWriteStream(logPath);
const compose = (...args: string[]) =>
  run('docker', ['compose', ...args], projectDir, { COMPOSE_PROJECT_NAME: name });

try {
  await (mode === 'image' ? smokeImage() : smokeDev());
  console.log(`✓ ${mode} smoke test passed`);
} catch (error) {
  console.error(
    `✗ ${mode} smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error(`  see ${logPath}`);
  process.exitCode = 1;
} finally {
  await cleanUp();
  log.end();
}

/** The production image, run on compose's network with the service URLs the dev container gets. */
async function smokeImage(): Promise<void> {
  // Installed on the host: the image builds from the lockfile, and the host migrates and seeds.
  await generate(['--no-git']);
  await compose('up', '-d', '--wait');
  for (const script of ['db:migrate', 'db:seed']) {
    await run('npm', ['run', script, '--if-present'], projectDir);
  }
  step('migrated and seeded from the host');

  await run('docker', ['build', '--tag', name, '.'], projectDir);
  step('built the production image');
  const containerEnv = Object.entries(containerValues()).flatMap(([key, value]) => [
    '--env',
    `${key}=${value}`,
  ]);
  await run(
    'docker',
    [
      'run',
      '--detach',
      '--name',
      name,
      '--network',
      `${name}_default`,
      '--env-file',
      '.env',
      // .env says development, which loads pino-pretty, a dev dependency the image doesn't have.
      '--env',
      'NODE_ENV=production',
      ...containerEnv,
      '--publish',
      `${PORT}:${PORT}`,
      name,
    ],
    projectDir,
  );
  await checkApi();
}

/** `--dev-env docker`: compose runs everything, the API's setup included. */
async function smokeDev(): Promise<void> {
  await generate(['--dev-env', 'docker', '--no-install', '--no-git']);
  await compose('up', '-d');
  await checkApi();
  if (options.projectType === 'fullstack') {
    await waitFor(WEB_URL, async () => (await fetch(WEB_URL)).ok);
    step('the web container serves the front end');
  }
}

async function generate(extraFlags: string[]): Promise<void> {
  await run(process.execPath, [CLI_PATH, projectDir, '--yes', ...extraFlags, ...cliFlags], ROOT);
  // Compose and the app both read PORT from .env.
  const envPath = path.join(projectDir, '.env');
  const env = await readFile(envPath, 'utf8');
  await writeFile(envPath, env.replace(/^PORT=.*$/m, `PORT=${PORT}`));
  step(`generated ${projectDir}`);
}

async function checkApi(): Promise<void> {
  const baseUrl = `http://localhost:${PORT}`;
  await waitFor(`${baseUrl}/health`, async () => (await fetch(`${baseUrl}/health`)).ok);
  step('the API is healthy');

  const env = await readEnv();
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
  });
  if (response.status !== 200) {
    throw new Error(`the seeded admin's sign-in answered ${response.status}`);
  }
  step('the seeded admin signs in');
}

/** The URLs the API reaches compose's services by from inside a container. */
function containerValues(): Record<string, string> {
  const manifest = mergeManifests(resolveLayers(options, LAYERS), options);
  return Object.fromEntries(
    manifest.envGroups.flatMap(({ vars }) =>
      vars.flatMap(({ key, containerValue }) =>
        containerValue === undefined ? [] : [[key, containerValue] as const],
      ),
    ),
  );
}

async function readEnv(): Promise<Record<string, string>> {
  const content = await readFile(path.join(projectDir, '.env'), 'utf8');
  return Object.fromEntries(
    content
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const [key = '', ...value] = line.split('=');
        const raw = value.join('=');
        return [key, raw.startsWith('"') ? String(JSON.parse(raw)) : raw];
      }),
  );
}

async function waitFor(what: string, isReady: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReady().catch(() => false)) return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${what} did not answer within ${BOOT_TIMEOUT_MS / 60_000} minutes`);
}

async function cleanUp(): Promise<void> {
  // Logs first: they explain a failure, and the containers go next.
  await run('docker', ['logs', name], projectDir).catch(() => undefined);
  await compose('logs', '--no-color').catch(() => undefined);
  await run('docker', ['rm', '--force', name], projectDir).catch(() => undefined);
  await compose('down', '--volumes', '--remove-orphans').catch(() => undefined);
  if (mode === 'image') {
    await run('docker', ['image', 'rm', '--force', name], projectDir).catch(() => undefined);
  }
}

function step(message: string): void {
  console.log(`  ${message}`);
  log.write(`\n# ${message}\n`);
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<void> {
  log.write(`\n$ ${command} ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once('error', reject);
    child.once('close', (exitCode) =>
      exitCode === 0
        ? resolve()
        : reject(new Error(`${command} ${args.slice(0, 2).join(' ')} exited with ${exitCode}`)),
    );
  });
}
