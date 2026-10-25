import { describe, expect, it } from 'vitest';
import {
  detectPackageManager,
  detectPackageManagerVersion,
  packageManagerPin,
} from '../src/package-manager.ts';

describe('detectPackageManager', () => {
  it.each([
    ['pnpm/10.12.1 npm/? node/v24.15.0 darwin arm64', 'pnpm'],
    ['yarn/4.9.1 npm/? node/v24.15.0 linux x64', 'yarn'],
    ['bun/1.3.0 npm/? node/v24.15.0 darwin arm64', 'bun'],
    ['npm/11.4.2 node/v24.15.0 darwin arm64 workspaces/false', 'npm'],
    ['deno/2.4.0 npm/? deno/2.4.0 linux x64', undefined],
    [undefined, undefined],
  ])('detects %j as %s', (userAgent, expected) => {
    expect(detectPackageManager(userAgent)).toBe(expected);
  });
});

describe('detectPackageManagerVersion', () => {
  it.each([
    ['pnpm/10.12.1 npm/? node/v24.15.0 darwin arm64', 'pnpm', '10.12.1'],
    ['yarn/4.9.1 npm/? node/v24.15.0 linux x64', 'yarn', '4.9.1'],
    ['pnpm/11.0.0-rc.1 npm/? node/v24.15.0 linux x64', 'pnpm', '11.0.0-rc.1'],
  ] as const)('reads %j as %s %s', (userAgent, packageManager, expected) => {
    expect(detectPackageManagerVersion(userAgent, packageManager)).toBe(expected);
  });

  it.each([
    ['a different package manager launched us', 'pnpm/10.12.1 npm/? node/v24.15.0', 'yarn'],
    ['the version is unknown', 'pnpm/? npm/? node/v24.15.0', 'pnpm'],
    ['there is no version', 'pnpm', 'pnpm'],
    ['the version is not a version', 'pnpm/10.12.1;echo npm/? node/v24.15.0', 'pnpm'],
    ['there is no user agent', undefined, 'pnpm'],
  ] as const)('is undefined when %s', (_reason, userAgent, packageManager) => {
    expect(detectPackageManagerVersion(userAgent, packageManager)).toBeUndefined();
  });
});

describe('packageManagerPin', () => {
  it('pins the detected version', () => {
    expect(packageManagerPin('pnpm', '10.12.1')).toBe('pnpm@10.12.1');
  });

  it.each([
    ['pnpm', 'pnpm@10.34.8'],
    ['yarn', 'yarn@1.22.22'],
  ] as const)('pins the tested %s version when none was detected', (packageManager, expected) => {
    expect(packageManagerPin(packageManager, undefined)).toBe(expected);
  });

  it.each(['npm', 'bun'] as const)(
    'leaves %s unpinned, since corepack does not manage it',
    (packageManager) => {
      expect(packageManagerPin(packageManager, '1.2.3')).toBeUndefined();
    },
  );
});
