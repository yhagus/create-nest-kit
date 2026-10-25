// Loaded by cli.ts before anything else, possibly by a Node.js older than the one we support:
// keep this file free of imports and of syntax newer than ES2020.

/** Kept equal to `engines.node` in package.json and `MIN_NODE` in install.sh (a test checks both). */
export const MINIMUM_NODE_VERSION = '24.15.0';

/** True when `version` (e.g. `process.versions.node`) is at least `minimum`, compared as numbers. */
export function isNodeVersionSupported(version: string, minimum = MINIMUM_NODE_VERSION): boolean {
  const found = parseVersion(version);
  const required = parseVersion(minimum);
  if (found === undefined || required === undefined) return false;

  for (let index = 0; index < required.length; index++) {
    const foundPart = found[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (foundPart !== requiredPart) return foundPart > requiredPart;
  }
  return true;
}

/** `[major, minor, patch]`, ignoring a prerelease suffix (`25.0.0-nightly…`). */
function parseVersion(version: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) return undefined;
  return match.slice(1).map(Number);
}
