import type { ProjectPlan } from './generate/compose.ts';

/** A plain-text listing of everything a run would write, for --dry-run. */
export function formatDryRun(plan: ProjectPlan): string {
  const files = [
    ...plan.templateFiles.map((file) => ({ target: file.target, origin: file.layerId })),
    ...plan.renderedFiles.map((file) => ({ target: file.target, origin: 'rendered' })),
  ].toSorted((a, b) => a.target.localeCompare(b.target, 'en'));
  const targetWidth = Math.max(0, ...files.map((file) => file.target.length));

  return [
    section(
      'Layers',
      plan.layers.map((layer) => layer.id),
    ),
    section(
      `Files (${files.length})`,
      files.map((file) => `${file.target.padEnd(targetWidth)}  ${file.origin}`),
    ),
    section('Dependencies', formatPins(plan.manifest.dependencies)),
    section('Dev dependencies', formatPins(plan.manifest.devDependencies)),
    'Dry run: nothing was written.',
  ].join('\n\n');
}

function section(title: string, lines: string[]): string {
  const body = lines.length > 0 ? lines.map((line) => `  ${line}`) : ['  (none)'];
  return [`${title}:`, ...body].join('\n');
}

function formatPins(pins: Record<string, string>): string[] {
  return Object.entries(pins)
    .toSorted(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([name, version]) => `${name}@${version}`);
}
