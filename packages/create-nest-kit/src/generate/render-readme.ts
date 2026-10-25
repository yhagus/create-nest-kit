import type { MergedManifest } from '../layers/merge.ts';
import { describeOptions } from '../labels.ts';
import type { ProjectOptions } from '../options.ts';
import { installCommand, runScriptCommand } from '../package-manager.ts';
import { MAILPIT_URL, quickstartCommands } from './quickstart.ts';
import { sortKeys } from './sort-keys.ts';

export function renderReadme(options: ProjectOptions, manifest: MergedManifest): string {
  const sections = [
    `# ${options.name}`,
    'Generated with [create-nest-kit](https://www.npmjs.com/package/create-nest-kit).',
    renderOptionsTable(options),
    renderQuickstart(options, manifest),
    renderScriptsTable(options, manifest),
    ...manifest.readmeSections.map((section) => `## ${section.title}\n\n${section.body.trim()}`),
  ];
  return `${sections.join('\n\n')}\n`;
}

function renderOptionsTable(options: ProjectOptions): string {
  return ['## Options', '', table(['Option', 'Value'], describeOptions(options))].join('\n');
}

function renderQuickstart(options: ProjectOptions, manifest: MergedManifest): string {
  const commands = [
    installCommand(options.packageManager),
    ...quickstartCommands(options, manifest),
  ];
  return [
    '## Quickstart',
    '',
    '```sh',
    ...commands,
    '```',
    '',
    `Mail sent in development is caught by Mailpit: ${MAILPIT_URL}`,
  ].join('\n');
}

function renderScriptsTable(options: ProjectOptions, manifest: MergedManifest): string {
  const rows = Object.entries(sortKeys(manifest.scripts)).map(([script, command]): TableRow => [
    code(runScriptCommand(options.packageManager, script)),
    code(command),
  ]);
  return ['## Scripts', '', table(['Command', 'Runs'], rows)].join('\n');
}

function code(text: string): string {
  return `\`${text.replaceAll('|', '\\|')}\``;
}

/** Prettier never narrows a delimiter cell below `---`. */
const MIN_COLUMN_WIDTH = 3;

type TableRow = [string, string];

/**
 * Pads every column to its widest cell, as prettier lays out markdown tables, so the README
 * passes the project's format:check. Widths are string lengths: the cells are ASCII.
 */
function table(headers: TableRow, rows: TableRow[]): string {
  const cells = [headers, ...rows];
  const leftWidth = Math.max(MIN_COLUMN_WIDTH, ...cells.map(([left]) => left.length));
  const rightWidth = Math.max(MIN_COLUMN_WIDTH, ...cells.map(([, right]) => right.length));
  const line = ([left, right]: TableRow) =>
    `| ${left.padEnd(leftWidth)} | ${right.padEnd(rightWidth)} |`;
  const delimiter: TableRow = ['-'.repeat(leftWidth), '-'.repeat(rightWidth)];
  return [headers, delimiter, ...rows].map(line).join('\n');
}
