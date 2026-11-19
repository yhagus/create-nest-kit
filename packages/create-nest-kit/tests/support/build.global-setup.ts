import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT } from './paths.ts';

/** Every test runs the built `dist/cli.js`, exactly as a user would. Build once before the suite. */
export default function buildCli(): void {
  execFileSync('pnpm', ['run', 'build'], { cwd: PACKAGE_ROOT, stdio: 'inherit' });
}
