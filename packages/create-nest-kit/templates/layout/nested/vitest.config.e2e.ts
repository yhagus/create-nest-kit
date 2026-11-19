import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata the way tsc does; Nest's dependency injection relies on it.
  plugins: [swc.vite()],
  test: {
    include: ['test/**/*.e2e-spec.ts', 'test/**/*.int-spec.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    // Test files share one database and one Redis, so they run one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 15_000,
  },
});
