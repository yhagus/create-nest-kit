// Generates each combo into <matrix dir>/<id> and runs install, typecheck, lint, format:check, test and
// test:e2e in it.
// Run with `pnpm matrix [--only <glob>] [--subset pr|all] [--steps a,b] [--keep]` (builds the CLI first).
// `--list` prints the ids of the ready selected combos as a JSON array instead; CI builds its job matrix from it.
import { spawn } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS } from '../packages/create-nest-kit/src/layers/registry.ts';
import {
  parseMatrixArgs,
  partitionByReadiness,
  selectCombos,
  type MatrixStep,
} from '../packages/create-nest-kit/src/matrix/select.ts';
import type { Combo } from '../packages/create-nest-kit/src/options.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Outside the repo: inside it, pnpm would treat each project as part of this workspace
// and oxlint would skip it because of the root .gitignore.
const MATRIX_DIR = process.env.MATRIX_DIR ?? path.join(os.tmpdir(), 'create-nest-kit-matrix');
const CLI_PATH = path.join(ROOT, 'packages/create-nest-kit/dist/cli.js');

// The CLI pins the version of the package manager that launched it. `pnpm matrix` would pass on
// pnpm's user agent while CI runs this script with node, so drop it: every run then tests the
// default pin from src/package-manager.ts.
delete process.env.npm_config_user_agent;

type StepOutcome = 'pass' | 'fail' | 'not run';

interface MatrixCommand {
  name: string;
  command: string;
  args: string[];
  cwd: string;
}

interface ComboResult {
  combo: Combo;
  outcomes: Map<string, StepOutcome>;
}

const config = parseMatrixArgs(process.argv.slice(2));
const { ready, skipped } = partitionByReadiness(selectCombos(config), LAYERS);

if (config.list) {
  console.log(JSON.stringify(ready.map((combo) => combo.id)));
} else {
  process.exitCode = await runMatrix();
}

/** Runs every ready combo and prints the summary. Returns the exit code. */
async function runMatrix(): Promise<number> {
  for (const { combo, plannedLayerIds } of skipped) {
    console.log(`skip ${combo.id}: planned layers ${plannedLayerIds.join(', ')}`);
  }
  if (ready.length === 0) {
    console.log('No selected combo has all its layers ready; nothing to run.');
  }

  await mkdir(MATRIX_DIR, { recursive: true });
  const results: ComboResult[] = [];
  for (const combo of ready) {
    results.push(await runCombo(combo, config.steps, config.keep));
  }

  printSummary(results, ['generate', ...config.steps]);
  const hasFailure = results.some((result) => [...result.outcomes.values()].includes('fail'));
  return hasFailure ? 1 : 0;
}

async function runCombo(combo: Combo, steps: MatrixStep[], keep: boolean): Promise<ComboResult> {
  const projectDir = path.join(MATRIX_DIR, combo.id);
  const logPath = path.join(MATRIX_DIR, `${combo.id}.log`);
  // A fresh directory every run: the CLI never deletes, so stale files would otherwise linger.
  await rm(projectDir, { recursive: true, force: true });
  const log = createWriteStream(logPath);

  const commands: MatrixCommand[] = [
    {
      name: 'generate',
      command: process.execPath,
      args: [CLI_PATH, projectDir, ...comboFlags(combo)],
      cwd: ROOT,
    },
    ...steps.map((step) => ({
      name: step,
      command: 'pnpm',
      args: stepArgs(step),
      cwd: projectDir,
    })),
  ];

  const outcomes = new Map<string, StepOutcome>(commands.map(({ name }) => [name, 'not run']));
  console.log(`\n▶ ${combo.id}`);
  for (const { name, command, args, cwd } of commands) {
    const isSuccess = await runLogged(command, args, cwd, log);
    outcomes.set(name, isSuccess ? 'pass' : 'fail');
    console.log(`  ${isSuccess ? '✓' : '✗'} ${name}`);
    if (!isSuccess) {
      console.log(`  see ${logPath}`);
      break;
    }
  }
  log.end();

  const hasPassed = [...outcomes.values()].every((outcome) => outcome === 'pass');
  if (hasPassed && !keep) await rm(projectDir, { recursive: true, force: true });
  return { combo, outcomes };
}

function comboFlags(combo: Combo): string[] {
  return [
    '--platform',
    combo.platform,
    '--db',
    combo.database,
    '--orm',
    combo.orm,
    '--auth',
    combo.auth,
    '--validation',
    combo.validation,
    '--pm',
    'pnpm',
    '--no-git',
    '--no-install',
    '--yes',
    '--force',
  ];
}

function stepArgs(step: MatrixStep): string[] {
  return step === 'install' ? ['install'] : ['run', step];
}

function runLogged(
  command: string,
  args: string[],
  cwd: string,
  log: WriteStream,
): Promise<boolean> {
  log.write(`\n$ ${command} ${args.join(' ')}\n`);
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once('error', (error) => {
      log.write(`${String(error)}\n`);
      resolve(false);
    });
    child.once('close', (exitCode) => resolve(exitCode === 0));
  });
}

function printSummary(comboResults: ComboResult[], columns: string[]): void {
  if (comboResults.length === 0) return;
  const symbols: Record<StepOutcome, string> = { pass: '✓', fail: '✗', 'not run': '-' };
  const idWidth = Math.max(...comboResults.map((result) => result.combo.id.length));
  const header = ['combo'.padEnd(idWidth), ...columns].join('  ');
  const rows = comboResults.map((result) =>
    [
      result.combo.id.padEnd(idWidth),
      ...columns.map((column) =>
        symbols[result.outcomes.get(column) ?? 'not run'].padEnd(column.length),
      ),
    ].join('  '),
  );
  console.log(['', header, ...rows].join('\n'));
}
