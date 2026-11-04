import type { MergedManifest } from '../layers/merge.ts';
import { describeOptions } from '../labels.ts';
import type { ProjectOptions } from '../options.ts';
import { installCommand, runScriptCommand } from '../package-manager.ts';
import {
  DEV_CONTAINER_SERVICE,
  MAILPIT_URL,
  quickstartCommands,
  quickstartScripts,
  WEB_CONTAINER_SERVICE,
  WEB_DEV_URL,
  webQuickstartCommands,
} from './quickstart.ts';
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
    ...(options.devEnvironment === 'docker' ? [devContainerNotes(options, manifest), ''] : []),
    ...webQuickstart(options),
    `Mail sent in development is caught by Mailpit: ${MAILPIT_URL}`,
  ].join('\n');
}

/** How to start the front end of an API + web project, as lines of the quickstart. */
function webQuickstart(options: ProjectOptions): string[] {
  if (options.projectType !== 'fullstack') return [];
  if (options.devEnvironment === 'docker') {
    return [
      `The front end runs in the \`${WEB_CONTAINER_SERVICE}\` container, at ${WEB_DEV_URL}, and reloads on every change in \`web/\`.`,
      '',
    ];
  }
  return [
    `The front end, in a second terminal (${WEB_DEV_URL}):`,
    '',
    '```sh',
    ...webQuickstartCommands(options, false),
    '```',
    '',
  ];
}

function devContainerNotes(options: ProjectOptions, manifest: MergedManifest): string {
  const service = DEV_CONTAINER_SERVICE;
  const scripts = quickstartScripts(manifest).map(code).join(', ');
  return `
The API runs in the \`${service}\` container. On every start it installs dependencies into its own \`node-modules\` volume and runs ${scripts}; \`start:dev\` then restarts the API on every change to the sources.

- Inside the container, the services are reached by name: \`docker-compose.yml\` overrides the URLs that \`.env\` points at \`localhost\`, which is still what tools on your machine use.
- Run other scripts there: \`docker compose exec ${service} npm run <script>\`. After changing dependencies, \`docker compose restart ${service}\`.
- The install on your machine is for your editor and the tests: run \`${runScriptCommand(options.packageManager, 'test')}\` and \`${runScriptCommand(options.packageManager, 'test:e2e')}\` there, since the e2e tests start their own containers.
`.trim();
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
