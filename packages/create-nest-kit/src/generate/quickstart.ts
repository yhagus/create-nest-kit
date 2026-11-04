import type { MergedManifest } from '../layers/merge.ts';
import type { ProjectOptions } from '../options.ts';
import { runScriptCommand } from '../package-manager.ts';

export const MAILPIT_URL = 'http://localhost:8025';

/** The compose service the API runs in with `--dev-env docker`. */
export const DEV_CONTAINER_SERVICE = 'api';

/** Where the front end of an API + web project lives, and the compose service it runs in with `--dev-env docker`. */
export const WEB_DIRECTORY = 'web';
export const WEB_CONTAINER_SERVICE = 'web';
export const WEB_DEV_URL = 'http://localhost:5173';

/** Scripts a fresh project runs, in order, after the services are up. */
const QUICKSTART_SCRIPTS = ['db:migrate', 'db:seed', 'start:dev'];

/** `QUICKSTART_SCRIPTS` without the ones no layer defines. */
export function quickstartScripts(manifest: MergedManifest): string[] {
  return QUICKSTART_SCRIPTS.filter((script) => script in manifest.scripts);
}

/**
 * Commands that take a freshly installed project to a running API. In Docker, the dev container
 * runs the quickstart scripts itself, so the logs are all there is to follow.
 */
export function quickstartCommands(options: ProjectOptions, manifest: MergedManifest): string[] {
  if (options.devEnvironment === 'docker') {
    const services = [
      DEV_CONTAINER_SERVICE,
      ...(options.projectType === 'fullstack' ? [WEB_CONTAINER_SERVICE] : []),
    ];
    return ['docker compose up -d', `docker compose logs -f ${services.join(' ')}`];
  }
  const scriptCommands = quickstartScripts(manifest).map((script) =>
    runScriptCommand(options.packageManager, script),
  );
  return ['docker compose up -d', ...scriptCommands];
}

/**
 * Commands that start the front end on the host, from the project folder: none without one, or
 * when its container runs it. `isInstalled` drops `bun install`.
 */
export function webQuickstartCommands(options: ProjectOptions, isInstalled: boolean): string[] {
  if (options.projectType !== 'fullstack' || options.devEnvironment === 'docker') return [];
  return [`cd ${WEB_DIRECTORY}`, ...(isInstalled ? [] : ['bun install']), 'bun run dev'];
}
