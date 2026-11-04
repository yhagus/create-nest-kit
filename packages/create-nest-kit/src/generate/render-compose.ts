import { stringify } from 'yaml';
import type { MergedManifest } from '../layers/merge.ts';
import type { PackageManager, ProjectOptions } from '../options.ts';
import {
  DEV_CONTAINER_SERVICE,
  quickstartScripts,
  WEB_CONTAINER_SERVICE,
  WEB_DIRECTORY,
} from './quickstart.ts';
import { sortKeys } from './sort-keys.ts';

/** The image the Dockerfile builds on, so development and production run the same Node. */
const DEV_CONTAINER_IMAGE = 'node:24-alpine';
/**
 * The bun the Dockerfile installs with. The Node image has none and corepack doesn't manage bun,
 * so the API container fetches it with npx; the front end's container is a bun image.
 */
const BUN_VERSION = '1.4.0';
/** The dev container's own node_modules, built for Linux. It hides the host's in the mount. */
const NODE_MODULES_VOLUME = 'node-modules';
/** The same, for the front end's container. */
const WEB_NODE_MODULES_VOLUME = 'web-node-modules';
/** Nuxt's dev server port, set in web/nuxt.config.ts. */
const WEB_DEV_PORT = 5173;

export function renderDockerCompose(options: ProjectOptions, manifest: MergedManifest): string {
  const services = { ...manifest.composeServices };
  const volumeNames = [...manifest.composeVolumes];
  if (options.devEnvironment === 'docker') {
    services[DEV_CONTAINER_SERVICE] = devContainerService(options, manifest);
    volumeNames.push(NODE_MODULES_VOLUME);
    if (options.projectType === 'fullstack') {
      services[WEB_CONTAINER_SERVICE] = webContainerService();
      volumeNames.push(WEB_NODE_MODULES_VOLUME);
    }
  }
  volumeNames.sort();
  const compose = {
    services: sortKeys(services),
    ...(volumeNames.length > 0 && {
      volumes: Object.fromEntries(volumeNames.map((name) => [name, {}])),
    }),
  };
  // Compose files are traditionally read with YAML 1.1 rules (e.g. `22:22` is a base-60 number),
  // so quote whatever 1.1 would misread.
  return stringify(compose, { version: '1.1' });
}

/**
 * The API in development: the project mounted at /app, installed into its own volume, then the
 * quickstart scripts, the last of which (`start:dev`) watches the mounted sources. Scripts run
 * through npm, which the image always has, as in the Dockerfile.
 */
function devContainerService(options: ProjectOptions, manifest: MergedManifest): unknown {
  const commands = [
    containerInstallCommand(options.packageManager),
    ...quickstartScripts(manifest).map((script) => `npm run ${script}`),
  ];
  const containerValues = manifest.envGroups.flatMap(({ vars }) =>
    vars.flatMap(({ key, containerValue }) =>
      containerValue === undefined ? [] : [[key, containerValue] as const],
    ),
  );
  return {
    image: DEV_CONTAINER_IMAGE,
    working_dir: '/app',
    command: ['sh', '-c', commands.join(' && ')],
    environment: {
      ...(usesCorepack(options.packageManager) && { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }),
      // The app still reads .env from the mount, but variables set here win.
      ...Object.fromEntries(containerValues),
    },
    // Compose reads PORT from .env too, so the published port follows it.
    ports: ['${PORT:-3000}:${PORT:-3000}'],
    volumes: ['.:/app', `${NODE_MODULES_VOLUME}:/app/node_modules`],
    depends_on: Object.fromEntries(
      Object.entries(manifest.composeServices).map(([name, service]) => [
        name,
        { condition: hasHealthcheck(service) ? 'service_healthy' : 'service_started' },
      ]),
    ),
  };
}

/**
 * The front end in development: `web/` mounted at /app, installed into its own volume, then Nuxt's
 * dev server. It needs nothing else in compose: the browser calls the API on its published port.
 */
function webContainerService(): unknown {
  return {
    image: `oven/bun:${BUN_VERSION}-alpine`,
    working_dir: '/app',
    // Nuxt listens on localhost only by default, which the published port can't reach.
    command: ['sh', '-c', 'bun install && bun run dev --host 0.0.0.0'],
    ports: [`${WEB_DEV_PORT}:${WEB_DEV_PORT}`],
    volumes: [`./${WEB_DIRECTORY}:/app`, `${WEB_NODE_MODULES_VOLUME}:/app/node_modules`],
  };
}

function containerInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'npm':
      return 'npm install';
    case 'pnpm':
    case 'yarn':
      // Corepack runs the version package.json pins.
      return `corepack ${packageManager} install`;
    case 'bun':
      return `npx --yes bun@${BUN_VERSION} install`;
  }
}

function usesCorepack(packageManager: PackageManager): boolean {
  return packageManager === 'pnpm' || packageManager === 'yarn';
}

function hasHealthcheck(service: unknown): boolean {
  return typeof service === 'object' && service !== null && 'healthcheck' in service;
}
