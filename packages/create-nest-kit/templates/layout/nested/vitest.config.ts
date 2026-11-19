import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata the way tsc does; Nest's dependency injection relies on it.
  plugins: [swc.vite()],
  test: {
    include: ['tests/**/*.test.ts'],
    // Starts the database, Redis and Mailpit containers and migrates the database.
    globalSetup: ['tests/support/global-setup.ts'],
    // Test files share one database, one Redis and one mailbox, so they run one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 15_000,
  },
});
