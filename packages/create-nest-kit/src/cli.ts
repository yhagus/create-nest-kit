#!/usr/bin/env node
import { isNodeVersionSupported, MINIMUM_NODE_VERSION } from './node-version.ts';

// The version check runs before the rest of the CLI is loaded: on an older Node.js, loading it could
// fail with a syntax or import error instead of this message.
if (isNodeVersionSupported(process.versions.node)) {
  const { run } = await import('./run.ts');
  process.exitCode = await run(process.argv.slice(2), {
    cwd: process.cwd(),
    userAgent: process.env.npm_config_user_agent,
    layerSetModule: process.env.NEST_KIT_LAYER_SET_MODULE,
  });
} else {
  process.stderr.write(
    `create-nest-kit needs Node.js ${MINIMUM_NODE_VERSION} or newer, but this is Node.js ${process.versions.node}.\n` +
      'Install Node.js 24 from https://nodejs.org, or with `fnm install 24` or `nvm install 24`.\n',
  );
  process.exitCode = 1;
}
