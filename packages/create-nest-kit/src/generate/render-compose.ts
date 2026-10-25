import { stringify } from 'yaml';
import type { MergedManifest } from '../layers/merge.ts';
import { sortKeys } from './sort-keys.ts';

export function renderDockerCompose(manifest: MergedManifest): string {
  const volumeNames = manifest.composeVolumes.toSorted();
  const compose = {
    services: sortKeys(manifest.composeServices),
    ...(volumeNames.length > 0 && {
      volumes: Object.fromEntries(volumeNames.map((name) => [name, {}])),
    }),
  };
  // Compose files are traditionally read with YAML 1.1 rules (e.g. `22:22` is a base-60 number),
  // so quote whatever 1.1 would misread.
  return stringify(compose, { version: '1.1' });
}
