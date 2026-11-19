import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
export const CLI_PATH = path.join(PACKAGE_ROOT, 'dist/cli.js');
