import { fileURLToPath } from 'node:url';

// This file sits directly in src/ (and dist/ once built), so `..` is the package root either way.

/** Holds one `<layer id>/` folder of template files per layer. */
export const TEMPLATES_DIR = fileURLToPath(new URL('../templates/', import.meta.url));

export const PACKAGE_JSON_PATH = fileURLToPath(new URL('../package.json', import.meta.url));
