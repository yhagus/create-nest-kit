import { stringify } from 'yaml';
import type { PackageManager, ProjectOptions } from '../options.ts';
import { frozenInstallCommand, runScriptCommand } from '../package-manager.ts';
import { PINNED_NODE_VERSION } from './pinned-node-version.ts';
import { WEB_DIRECTORY } from './quickstart.ts';
import { CHECK_SCRIPTS } from './render-ci.ts';
import { BUN_VERSION, COREPACK_VERSION } from './render-compose.ts';

/**
 * Where package managers keep their download stores in CI. GitLab only caches paths inside the
 * project, and the generated .prettierignore keeps `format:check` out of it.
 */
const CACHE_DIRECTORY = '.ci-cache';

/** How a job gets a package manager and points its download store into `CACHE_DIRECTORY`. */
interface PackageManagerSetup {
  /** Commands run before the install. The Node image has npm only. */
  commands: string[];
  lockfile: string;
  storeDirectory: string;
  variables: Record<string, string>;
}

/** The Node image no longer bundles corepack, so pnpm and yarn jobs install it first. */
const ENABLE_COREPACK = [`npm install --global corepack@${COREPACK_VERSION}`, 'corepack enable'];

function packageManagerSetup(packageManager: PackageManager): PackageManagerSetup {
  const storeDirectory = `${CACHE_DIRECTORY}/${packageManager}`;
  const storePath = `$CI_PROJECT_DIR/${storeDirectory}`;
  switch (packageManager) {
    case 'npm':
      return {
        commands: [],
        lockfile: 'package-lock.json',
        storeDirectory,
        variables: { npm_config_cache: storePath },
      };
    case 'pnpm':
      // Corepack runs the pnpm version that package.json's packageManager pins.
      return {
        commands: [...ENABLE_COREPACK, `pnpm config set store-dir ${storePath}`],
        lockfile: 'pnpm-lock.yaml',
        storeDirectory,
        variables: {},
      };
    case 'yarn':
      // Corepack runs the yarn that package.json's packageManager pins (Berry included). Berry
      // caches globally unless told not to; Yarn classic ignores that variable.
      return {
        commands: ENABLE_COREPACK,
        lockfile: 'yarn.lock',
        storeDirectory,
        variables: { YARN_CACHE_FOLDER: storePath, YARN_ENABLE_GLOBAL_CACHE: 'false' },
      };
    case 'bun':
      // Corepack doesn't manage bun. Scripts still run their tools with Node.
      return {
        commands: [`npm install --global bun@${BUN_VERSION}`],
        lockfile: 'bun.lock',
        storeDirectory,
        variables: { BUN_INSTALL_CACHE_DIR: storePath },
      };
  }
}

/** The feature tests start their databases with Testcontainers, which needs a Docker daemon. */
const DOCKER_SERVICE = { name: 'docker:dind', alias: 'docker', command: ['--tls=false'] };
const DOCKER_VARIABLES = { DOCKER_HOST: 'tcp://docker:2375', DOCKER_TLS_CERTDIR: '' };

export function renderGitlabCi(options: ProjectOptions): string {
  const packageManager = options.packageManager;
  const setup = packageManagerSetup(packageManager);
  const pipeline = {
    // Merge request pipelines and pushes to main only, so a branch with an open merge request
    // doesn't also run a branch pipeline.
    workflow: {
      rules: [
        { if: '$CI_PIPELINE_SOURCE == "merge_request_event"' },
        { if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "main"' },
      ],
    },
    default: { image: `node:${PINNED_NODE_VERSION}` },
    variables: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
    check: {
      services: [DOCKER_SERVICE],
      variables: { ...DOCKER_VARIABLES, ...setup.variables },
      cache: storeCache(setup.lockfile, setup.storeDirectory),
      before_script: [...setup.commands, frozenInstallCommand(packageManager)],
      script: CHECK_SCRIPTS.map((script) => runScriptCommand(packageManager, script)),
    },
    ...(options.projectType === 'fullstack' && { web: webJob() }),
  };
  // Single quotes where quoting is needed, as the project's Prettier config writes them.
  return stringify(pipeline, { singleQuote: true });
}

/** Builds the front end, which has its own package and always uses bun. */
function webJob(): Record<string, unknown> {
  const bun = packageManagerSetup('bun');
  return {
    variables: bun.variables,
    cache: storeCache(`${WEB_DIRECTORY}/${bun.lockfile}`, bun.storeDirectory),
    // before_script and script share one shell, so the `cd` holds for both.
    before_script: [...bun.commands, `cd ${WEB_DIRECTORY}`, frozenInstallCommand('bun')],
    script: [runScriptCommand('bun', 'generate')],
  };
}

/** Caches `directory`, renewed whenever the lockfile changes. */
function storeCache(lockfile: string, directory: string): Record<string, unknown> {
  return { key: { files: [lockfile] }, paths: [`${directory}/`] };
}
