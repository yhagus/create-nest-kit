import type { MergedManifest } from '../layers/merge.ts';
import type { ProjectOptions } from '../options.ts';
import { runScriptCommand } from '../package-manager.ts';

export const MAILPIT_URL = 'http://localhost:8025';

/** Scripts a fresh project runs, in order, after the services are up. */
const QUICKSTART_SCRIPTS = ['db:migrate', 'db:seed', 'start:dev'];

/** Commands that take a freshly installed project to a running API. Skips scripts no layer defines. */
export function quickstartCommands(options: ProjectOptions, manifest: MergedManifest): string[] {
  const scriptCommands = QUICKSTART_SCRIPTS.filter((script) => script in manifest.scripts).map(
    (script) => runScriptCommand(options.packageManager, script),
  );
  return ['docker compose up -d', ...scriptCommands];
}
