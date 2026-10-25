import { matchesGlob } from 'node:path';
import { parseArgs } from 'node:util';
import { comboPlannedLayerIds } from '../layers/resolve.ts';
import type { LayerManifest } from '../layers/types.ts';
import { listCombos, prSubset, type Combo } from '../options.ts';

// Pure helpers for scripts/matrix.ts, kept here so they are typed and tested with the installer.

export const MATRIX_STEPS = [
  'install',
  'typecheck',
  // `nest build`, which also copies the assets (mail templates) that typecheck can't see.
  'build',
  'lint',
  'format:check',
  'test',
  'test:e2e',
] as const;
export type MatrixStep = (typeof MATRIX_STEPS)[number];

const SUBSETS = ['pr', 'all'] as const;
export type MatrixSubset = (typeof SUBSETS)[number];

export interface MatrixConfig {
  /** Glob on the combo id, e.g. `*-mongodb-*`. */
  only: string | undefined;
  subset: MatrixSubset;
  steps: MatrixStep[];
  /** Keep generated projects that passed; failed ones are always kept. */
  keep: boolean;
  /** Print the ids of the ready selected combos as a JSON array, and run nothing (for CI matrices). */
  list: boolean;
}

export function parseMatrixArgs(argv: readonly string[]): MatrixConfig {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      only: { type: 'string' },
      subset: { type: 'string', default: 'all' },
      steps: { type: 'string', default: MATRIX_STEPS.join(',') },
      keep: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
    },
    strict: true,
  });
  return {
    only: values.only,
    subset: parseOneOf('--subset', SUBSETS, values.subset),
    steps: values.steps.split(',').map((step) => parseOneOf('--steps', MATRIX_STEPS, step.trim())),
    keep: values.keep,
    list: values.list,
  };
}

export function selectCombos(config: Pick<MatrixConfig, 'only' | 'subset'>): Combo[] {
  const combos = config.subset === 'pr' ? prSubset() : listCombos();
  const pattern = config.only;
  return pattern === undefined ? combos : combos.filter((combo) => matchesGlob(combo.id, pattern));
}

export interface SkippedCombo {
  combo: Combo;
  plannedLayerIds: string[];
}

/** Splits combos into those whose layers are all ready and those still waiting on planned layers. */
export function partitionByReadiness(
  combos: readonly Combo[],
  layers: readonly LayerManifest[],
): { ready: Combo[]; skipped: SkippedCombo[] } {
  const ready: Combo[] = [];
  const skipped: SkippedCombo[] = [];
  for (const combo of combos) {
    const plannedLayerIds = comboPlannedLayerIds(combo, layers);
    if (plannedLayerIds.length === 0) ready.push(combo);
    else skipped.push({ combo, plannedLayerIds });
  }
  return { ready, skipped };
}

function parseOneOf<T extends string>(flag: string, allowed: readonly T[], value: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new Error(`${flag} must be one of ${allowed.join(', ')} (got "${value}")`);
  }
  return match;
}
