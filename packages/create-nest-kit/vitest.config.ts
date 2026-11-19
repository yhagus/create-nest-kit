import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The install.sh scenarios need Docker and a packed release: `pnpm test:installer` runs them.
    exclude: [...configDefaults.exclude, 'tests/installer/**'],
    globalSetup: ['tests/support/build.global-setup.ts'],
    // Every test spawns the CLI, and tests/combos keeps every core busy for a while: a test that
    // takes 100ms alone can take seconds while it runs.
    testTimeout: 30_000,
  },
});
