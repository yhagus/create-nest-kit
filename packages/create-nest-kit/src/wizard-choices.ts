import path from 'node:path';
import { UsageError } from './args.ts';
import { DATABASE_LABELS, ORM_LABELS } from './labels.ts';
import { isComboReady } from './layers/resolve.ts';
import type { LayerManifest } from './layers/types.ts';
import {
  listCombos,
  ORMS_BY_DATABASE,
  packageNameProblem,
  type Combo,
  type Database,
  type Orm,
} from './options.ts';

// The wizard's decisions, kept apart from the clack prompts so they can be unit-tested.

const COMING_SOON = 'coming soon';

/** The code-shaping choices made so far; those not made yet are left out. */
export type PartialCombo = Partial<Omit<Combo, 'id'>>;

/** True when some ready combo matches every choice made so far. */
export type ComboAvailability = (choices: PartialCombo) => boolean;

/** Builds the availability check from the layers' status. Throws when no combo is ready at all. */
export function comboAvailability(layers: readonly LayerManifest[]): ComboAvailability {
  const readyCombos = listCombos().filter((combo) => isComboReady(combo, layers));
  if (readyCombos.length === 0) {
    throw new UsageError(
      'No project combination is available yet: all its layers are still planned.',
    );
  }
  return (choices) => readyCombos.some((combo) => matches(combo, choices));
}

function matches(combo: Combo, choices: PartialCombo): boolean {
  return (
    (choices.platform === undefined || combo.platform === choices.platform) &&
    (choices.database === undefined || combo.database === choices.database) &&
    (choices.orm === undefined || combo.orm === choices.orm) &&
    (choices.auth === undefined || combo.auth === choices.auth) &&
    (choices.validation === undefined || combo.validation === choices.validation)
  );
}

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: true;
}

export interface SelectStep<T> {
  options: SelectOption<T>[];
  /** The first available value: the value lists are ordered with the default first. */
  initialValue: T | undefined;
}

/** A select prompt over `values`. Values no ready combo offers are shown disabled ("coming soon"). */
export function selectStep<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  isAvailable: (value: T) => boolean,
  hints?: Record<T, string>,
): SelectStep<T> {
  return {
    options: values.map((value) =>
      isAvailable(value)
        ? { value, label: labels[value], hint: hints?.[value] }
        : {
            value,
            label: `${labels[value]} (${COMING_SOON})`,
            hint: hints?.[value],
            disabled: true,
          },
    ),
    initialValue: values.find(isAvailable),
  };
}

/** A database with a single ORM gets it without a prompt, only a note saying so. */
export type OrmStep =
  { kind: 'only'; orm: Orm; note: string } | ({ kind: 'select' } & SelectStep<Orm>);

export function ormStep(database: Database, isAvailable: (orm: Orm) => boolean): OrmStep {
  const orms: readonly Orm[] = ORMS_BY_DATABASE[database];
  const [onlyOrm] = orms;
  if (orms.length === 1 && onlyOrm !== undefined) {
    return {
      kind: 'only',
      orm: onlyOrm,
      note: `${DATABASE_LABELS[database]} uses ${ORM_LABELS[onlyOrm]}.`,
    };
  }
  return { kind: 'select', ...selectStep(orms, ORM_LABELS, isAvailable) };
}

/** The package name a directory implies: its last path segment. */
export function projectNameFor(cwd: string, directory: string): string {
  return path.basename(path.resolve(cwd, directory));
}

/** Why `directory` can't hold the project, or undefined when it can. */
export function directoryProblem(cwd: string, directory: string): string | undefined {
  const name = projectNameFor(cwd, directory);
  const problem = packageNameProblem(name);
  return problem ? `"${name}" can't be a package name: ${problem}` : undefined;
}
