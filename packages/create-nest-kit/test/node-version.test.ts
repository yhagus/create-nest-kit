import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { isNodeVersionSupported, MINIMUM_NODE_VERSION } from '../src/node-version.ts';

describe('isNodeVersionSupported', () => {
  it.each(['24.15.0', '24.15.1', '24.20.0', '25.0.0', '100.0.0'])('accepts %s', (version) => {
    expect(isNodeVersionSupported(version)).toBe(true);
  });

  it.each(['24.14.9', '24.9.0', '22.22.0', '18.20.8', '2.150.0', 'not-a-version'])(
    'rejects %s',
    (version) => {
      expect(isNodeVersionSupported(version)).toBe(false);
    },
  );

  it('compares a prerelease by its numeric part', () => {
    expect(isNodeVersionSupported('25.0.0-nightly20260101abc')).toBe(true);
  });
});

describe('MINIMUM_NODE_VERSION', () => {
  it('matches engines.node in package.json', async () => {
    const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');

    expect(packageJson).toContain(`"node": ">=${MINIMUM_NODE_VERSION.replace(/\.0$/, '')}"`);
  });

  it('matches MIN_NODE in install.sh', async () => {
    const installer = await readFile(new URL('../../../install.sh', import.meta.url), 'utf8');

    expect(installer).toContain(`MIN_NODE="${MINIMUM_NODE_VERSION}"`);
  });
});
