// Bundles the CLI into dist/ with every runtime dependency inlined, so the release archive runs with
// plain `node` and no `npm install`. Type checking stays with `tsc` (`pnpm typecheck`).
//
// dist/cli.js is only the Node.js version check; it loads dist/run.js (everything else) when the
// version is supported. Both sit in dist/, so `../templates/` and `../package.json` resolve from
// import.meta.url exactly as in the package layout.
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, type BuildOptions, type Plugin } from 'esbuild';

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));

const SHARED_OPTIONS = {
  absWorkingDir: PACKAGE_ROOT,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24.15',
  logLevel: 'warning',
} satisfies BuildOptions;

/** Leaves cli.ts's `import('./run.ts')` pointing at the separately built dist/run.js. */
const loadRunLazily: Plugin = {
  name: 'load-run-lazily',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\.\/run\.ts$/ }, () => ({
      path: './run.js',
      external: true,
    }));
  },
};

await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });

await build({
  ...SHARED_OPTIONS,
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.js',
  plugins: [loadRunLazily],
});

await build({
  ...SHARED_OPTIONS,
  entryPoints: ['src/run.ts'],
  outfile: 'dist/run.js',
  // yaml's Node.js entry is CommonJS and require()s Node built-ins, which ESM output has no
  // `require` for.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
