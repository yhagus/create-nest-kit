import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

/** The CLI tests run the built `dist/cli.js`, exactly as npm would. Build once before the suite. */
export default function buildCli(): void {
  execFileSync('pnpm', ['run', 'build'], { cwd: packageRoot, stdio: 'inherit' });
}
