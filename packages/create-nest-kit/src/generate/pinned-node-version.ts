/**
 * The one Node.js release every generated project targets: the latest LTS patch, bumped at each
 * release. `.nvmrc` and the Dockerfile are copied verbatim and repeat it as literals;
 * tests/rendered-files/node-version.test.ts fails when they drift from it.
 */
export const PINNED_NODE_VERSION = '26.13.1';
