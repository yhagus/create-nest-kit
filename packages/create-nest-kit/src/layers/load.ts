import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUILT_IN_LAYER_SET } from './registry.ts';
import type { LayerManifest, LayerSet } from './types.ts';

/**
 * The built-in layers, or — for the installer's own tests — the `layerSet`
 * exported by the module at `modulePath`.
 */
export async function loadLayerSet(modulePath: string | undefined): Promise<LayerSet> {
  if (modulePath === undefined) return BUILT_IN_LAYER_SET;

  const loaded: unknown = await import(pathToFileURL(path.resolve(modulePath)).href);
  const layerSet = isRecord(loaded) ? loaded.layerSet : undefined;
  if (!isLayerSet(layerSet)) {
    throw new Error(`${modulePath} must export \`layerSet\` with \`layers\` and \`templatesDir\``);
  }
  return layerSet;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLayerSet(value: unknown): value is LayerSet {
  return (
    isRecord(value) &&
    typeof value.templatesDir === 'string' &&
    Array.isArray(value.layers) &&
    value.layers.every(isLayerManifest)
  );
}

function isLayerManifest(value: unknown): value is LayerManifest {
  return isRecord(value) && typeof value.id === 'string' && typeof value.when === 'function';
}
