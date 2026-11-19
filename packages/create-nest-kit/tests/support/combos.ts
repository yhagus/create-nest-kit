import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { runCli } from './cli.ts';
import { REPO_ROOT } from './paths.ts';

const execFileAsync = promisify(execFile);

/** `<platform>-<database>-<orm>-<auth>-<validation>-<pattern>-<layout>`; class-validator holds a dash. */
const COMBO_ID = new RegExp(
  [
    '^(?<platform>fastify|express|node)',
    '(?<db>postgres|mongodb)',
    '(?<orm>drizzle|prisma|typeorm|mikroorm|mongoose)',
    '(?<auth>jwt|nest)',
    '(?<validation>zod|class-validator|valibot|arktype)',
    '(?<pattern>service|cqrs)',
    '(?<layout>nested|flat)$',
  ].join('-'),
);
/** Each part of a combo id is the value of the CLI flag of the same name. */
const COMBO_FLAGS = ['platform', 'db', 'orm', 'auth', 'validation', 'pattern', 'layout'];

export interface Combo {
  id: string;
  /** The value of each part of the id, by the name of its CLI flag: `{ platform: 'fastify', db: 'postgres', … }`. */
  choices: Record<string, string>;
  /** The CLI flags that select this combo. */
  flags: string[];
}

/** A combo id as the matrix prints it, turned into the CLI flags that select it. */
export function parseComboId(id: string): Combo {
  const groups = COMBO_ID.exec(id)?.groups;
  if (groups === undefined) throw new Error(`Not a combo id this suite knows: ${id}`);
  return {
    id,
    choices: { ...groups },
    flags: COMBO_FLAGS.flatMap((flag) => [`--${flag}`, groups[flag] ?? '']),
  };
}

/** The ready combos, as the repo's matrix script lists them: all, or the pairwise PR subset. */
export async function listCombos(subset: 'all' | 'pr'): Promise<Combo[]> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['scripts/matrix.ts', '--list', '--subset', subset],
    { cwd: REPO_ROOT },
  );
  return z.array(z.string()).parse(JSON.parse(stdout)).map(parseComboId);
}

export interface GeneratedCombo {
  combo: Combo;
  projectDir: string;
  /** The CLI's output when it failed, undefined when it succeeded. */
  failure: string | undefined;
}

/**
 * Generates each combo with `--yes --no-install --no-git` into `<root>/<id>`, a few at a time.
 * Returns the root, to be removed by the caller, and one result per combo.
 */
export async function generateCombos(
  combos: readonly Combo[],
): Promise<{ root: string; generated: GeneratedCombo[] }> {
  const root = await mkdtemp(path.join(tmpdir(), 'create-nest-kit-combos-'));
  const generated = await mapConcurrently(combos, async (combo) => {
    const result = await runCli([combo.id, '--yes', '--no-install', '--no-git', ...combo.flags], {
      cwd: root,
    });
    return {
      combo,
      projectDir: path.join(root, combo.id),
      failure: result.exitCode === 0 ? undefined : result.stderr || result.stdout,
    };
  });
  return { root, generated };
}

/** `mapper` over `items` with at most one call in flight per CPU core, keeping the order. */
export async function mapConcurrently<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item);
    }
  };
  await Promise.all(Array.from({ length: availableParallelism() }, worker));
  return results;
}
