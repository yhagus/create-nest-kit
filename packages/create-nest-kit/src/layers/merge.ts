import { isDeepStrictEqual } from 'node:util';
import type { ProjectOptions } from '../options.ts';
import type { LayerManifest, OptionDependent } from './types.ts';

export interface ResolvedEnvVar {
  key: string;
  value: string;
  comment?: string;
  isSecret: boolean;
}

export interface EnvGroup {
  layerId: string;
  vars: ResolvedEnvVar[];
}

export interface ResolvedReadmeSection {
  layerId: string;
  title: string;
  body: string;
}

/** All layer manifests of one project folded into one, with option-dependent values resolved. */
export interface MergedManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  packageJson: Record<string, unknown>;
  /** One group per layer that declares variables, in layer order. */
  envGroups: EnvGroup[];
  composeServices: Record<string, unknown>;
  composeVolumes: string[];
  readmeSections: ResolvedReadmeSection[];
}

export class ManifestConflictError extends Error {
  override name = 'ManifestConflictError';

  readonly conflicts: string[];

  constructor(conflicts: string[]) {
    super(`Layers disagree:\n${conflicts.map((conflict) => `  - ${conflict}`).join('\n')}`);
    this.conflicts = conflicts;
  }
}

/** Fields the package.json renderer owns; layers set them through their dedicated manifest fields. */
const RENDERER_OWNED_PACKAGE_FIELDS = new Set([
  'name',
  'version',
  'private',
  'type',
  'engines',
  'packageManager',
  'scripts',
  'dependencies',
  'devDependencies',
]);

/**
 * Folds the resolved layers' manifests into one. The same key from two layers
 * is allowed only when both give the same value; anything else is a conflict.
 * Throws ManifestConflictError listing every conflict.
 */
export function mergeManifests(
  layers: readonly LayerManifest[],
  options: ProjectOptions,
): MergedManifest {
  const merger = new ManifestMerger(options);
  for (const layer of layers) merger.add(layer);
  return merger.result();
}

/** A keyed value and the layer that set it first, so conflicts can name both layers. */
interface Owned<T> {
  value: T;
  layerId: string;
}

class ManifestMerger {
  private readonly dependencies = new Map<string, Owned<string>>();
  private readonly devDependencies = new Map<string, Owned<string>>();
  private readonly scripts = new Map<string, Owned<string>>();
  private readonly envVars = new Map<string, Owned<ResolvedEnvVar>>();
  private readonly composeServices = new Map<string, Owned<unknown>>();
  private readonly composeVolumes = new Set<string>();
  private readonly packageJson: Record<string, unknown> = {};
  private readonly envGroups: EnvGroup[] = [];
  private readonly readmeSections: ResolvedReadmeSection[] = [];
  private readonly conflicts: string[] = [];
  private readonly options: ProjectOptions;

  constructor(options: ProjectOptions) {
    this.options = options;
  }

  add(layer: LayerManifest): void {
    this.addKeyed('dependency', this.dependencies, layer.dependencies, layer.id);
    this.addKeyed('devDependency', this.devDependencies, layer.devDependencies, layer.id);
    this.addKeyed('script', this.scripts, layer.scripts, layer.id);
    this.addKeyed('compose service', this.composeServices, layer.compose?.services, layer.id);
    for (const volume of layer.compose?.volumes ?? []) this.composeVolumes.add(volume);
    this.addPackageJson(layer);
    this.addEnv(layer);
    this.addReadme(layer);
  }

  result(): MergedManifest {
    if (this.conflicts.length > 0) throw new ManifestConflictError(this.conflicts);
    return {
      dependencies: valuesOf(this.dependencies),
      devDependencies: valuesOf(this.devDependencies),
      scripts: valuesOf(this.scripts),
      packageJson: this.packageJson,
      envGroups: this.envGroups,
      composeServices: valuesOf(this.composeServices),
      composeVolumes: [...this.composeVolumes],
      readmeSections: this.readmeSections,
    };
  }

  /** Adds entries, returning the keys that were new (as opposed to repeated with the same value). */
  private addKeyed<T>(
    kind: string,
    target: Map<string, Owned<T>>,
    entries: Record<string, T> | undefined,
    layerId: string,
  ): Set<string> {
    const addedKeys = new Set<string>();
    for (const [key, value] of Object.entries(entries ?? {})) {
      const existing = target.get(key);
      if (!existing) {
        target.set(key, { value, layerId });
        addedKeys.add(key);
        continue;
      }
      if (!isDeepStrictEqual(existing.value, value)) {
        this.conflicts.push(
          `${kind} "${key}": ${existing.layerId} sets ${describe(existing.value)}, ${layerId} sets ${describe(value)}`,
        );
      }
    }
    return addedKeys;
  }

  private addEnv(layer: LayerManifest): void {
    const resolved = (layer.env ?? []).map((envVar) => ({
      key: envVar.key,
      value: this.resolve(envVar.value),
      ...(envVar.comment === undefined ? {} : { comment: envVar.comment }),
      isSecret: envVar.secret ?? false,
    }));
    const entries = Object.fromEntries(resolved.map((envVar) => [envVar.key, envVar]));
    const newKeys = this.addKeyed('env var', this.envVars, entries, layer.id);

    // A variable repeated with the same value stays in the group of the layer that declared it first.
    const vars = resolved.filter((envVar) => newKeys.has(envVar.key));
    if (vars.length > 0) this.envGroups.push({ layerId: layer.id, vars });
  }

  private addReadme(layer: LayerManifest): void {
    for (const section of layer.readme ?? []) {
      this.readmeSections.push({
        layerId: layer.id,
        title: section.title,
        body: this.resolve(section.body),
      });
    }
  }

  private addPackageJson(layer: LayerManifest): void {
    for (const key of Object.keys(layer.packageJson ?? {})) {
      if (RENDERER_OWNED_PACKAGE_FIELDS.has(key)) {
        this.conflicts.push(
          `package.json field "${key}" in ${layer.id}: use the manifest's dedicated field instead of packageJson`,
        );
      }
    }
    this.mergeObject(this.packageJson, layer.packageJson ?? {}, '', layer.id);
  }

  /** Deep-merges `source` into `target`: objects merge recursively, arrays are unioned, other values must match. */
  private mergeObject(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    parentPath: string,
    layerId: string,
  ): void {
    for (const [key, value] of Object.entries(source)) {
      const path = parentPath ? `${parentPath}.${key}` : key;
      const existing = target[key];
      if (existing === undefined) {
        target[key] = structuredClone(value);
      } else if (isPlainObject(existing) && isPlainObject(value)) {
        this.mergeObject(existing, value, path, layerId);
      } else if (Array.isArray(existing) && Array.isArray(value)) {
        const additions = value.filter((item) => !existing.some((e) => isDeepStrictEqual(e, item)));
        existing.push(...structuredClone(additions));
      } else if (!isDeepStrictEqual(existing, value)) {
        this.conflicts.push(
          `package.json field "${path}": ${layerId} sets ${describe(value)}, an earlier layer set ${describe(existing)}`,
        );
      }
    }
  }

  private resolve(value: OptionDependent<string>): string {
    return typeof value === 'function' ? value(this.options) : value;
  }
}

function valuesOf<T>(owned: Map<string, Owned<T>>): Record<string, T> {
  return Object.fromEntries([...owned].map(([key, entry]) => [key, entry.value]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
