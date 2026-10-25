import { optionsForCombo, type Combo, type ProjectOptions } from '../options.ts';
import type { LayerManifest } from './types.ts';

/** The layers that make up a project with these options, in composition order. */
export function resolveLayers(
  options: ProjectOptions,
  layers: readonly LayerManifest[],
): LayerManifest[] {
  return layers.filter((layer) => layer.when(options));
}

/** Ids of the resolved layers that are still `planned`. Empty when the project can be generated. */
export function plannedLayerIds(
  options: ProjectOptions,
  layers: readonly LayerManifest[],
): string[] {
  return resolveLayers(options, layers)
    .filter((layer) => layer.status === 'planned')
    .map((layer) => layer.id);
}

/** Ids of a combo's layers that are still `planned`, with every non-combo option at its default. */
export function comboPlannedLayerIds(combo: Combo, layers: readonly LayerManifest[]): string[] {
  return plannedLayerIds(optionsForCombo(combo), layers);
}

export function isComboReady(combo: Combo, layers: readonly LayerManifest[]): boolean {
  return comboPlannedLayerIds(combo, layers).length === 0;
}
