import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata the way tsc does; Nest's dependency injection relies on it.
  plugins: [swc.vite()],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
  },
});
