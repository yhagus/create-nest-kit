import { defineConfig } from 'vitest/config';

// install.sh in Docker, against the release archive. Run through `pnpm test:installer` at the repo
// root, which builds the CLI and packs release/ first.
export default defineConfig({
  test: {
    include: ['tests/installer/**/*.test.ts'],
  },
});
