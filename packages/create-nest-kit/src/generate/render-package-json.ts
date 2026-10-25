import type { MergedManifest } from '../layers/merge.ts';
import type { ProjectOptions } from '../options.ts';
import { packageManagerPin } from '../package-manager.ts';
import { sortKeys } from './sort-keys.ts';

const INITIAL_VERSION = '0.0.1';
export const NODE_ENGINE_RANGE = '>=24.15';

export function renderPackageJson(options: ProjectOptions, manifest: MergedManifest): string {
  const packageManager = packageManagerPin(options.packageManager, options.packageManagerVersion);
  const packageJson = {
    name: options.name,
    version: INITIAL_VERSION,
    private: true,
    type: 'module',
    engines: { node: NODE_ENGINE_RANGE },
    ...(packageManager && { packageManager }),
    scripts: sortKeys(manifest.scripts),
    dependencies: sortKeys(manifest.dependencies),
    devDependencies: sortKeys(manifest.devDependencies),
    ...sortKeys(manifest.packageJson),
  };
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}
