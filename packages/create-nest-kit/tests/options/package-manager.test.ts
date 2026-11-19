import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { listFiles, readPackageJson } from '../support/project.ts';

const LOCKFILE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/;

describe('the package manager pin in package.json', () => {
  it.each([
    {
      when: 'pnpm launched the installer',
      args: [],
      userAgent: 'pnpm/10.12.1 npm/? node/v24.15.0 darwin arm64',
      pin: 'pnpm@10.12.1',
    },
    {
      when: 'yarn launched the installer',
      args: [],
      userAgent: 'yarn/4.9.1 npm/? node/v24.15.0 linux x64',
      pin: 'yarn@4.9.1',
    },
    {
      when: 'a prerelease pnpm launched the installer',
      args: [],
      userAgent: 'pnpm/11.0.0-rc.1 npm/? node/v24.15.0 linux x64',
      pin: 'pnpm@11.0.0-rc.1',
    },
    {
      when: '--pm pnpm is given',
      args: ['--pm', 'pnpm'],
      userAgent: undefined,
      pin: 'pnpm@10.34.8',
    },
    {
      when: '--pm yarn is given',
      args: ['--pm', 'yarn'],
      userAgent: undefined,
      pin: 'yarn@1.22.22',
    },
    {
      when: '--pm pnpm is given while yarn launched the installer',
      args: ['--pm', 'pnpm'],
      userAgent: 'yarn/4.9.1 npm/? node/v24.15.0 linux x64',
      pin: 'pnpm@10.34.8',
    },
    {
      when: "the launcher's version is not a version",
      args: [],
      userAgent: 'pnpm/10.12.1;echo npm/? node/v24.15.0',
      pin: 'pnpm@10.34.8',
    },
  ])('is $pin when $when', async ({ args, userAgent, pin }) => {
    const projectDir = await generateProject(args, { npm_config_user_agent: userAgent });

    expect((await readPackageJson(projectDir)).packageManager).toBe(pin);
  });

  it.each([
    { when: 'nothing launched the installer', args: [], userAgent: undefined },
    {
      when: 'npm launched the installer',
      args: [],
      userAgent: 'npm/11.4.2 node/v24.15.0 darwin arm64',
    },
    {
      when: 'deno launched the installer',
      args: [],
      userAgent: 'deno/2.4.0 npm/? deno/2.4.0 linux x64',
    },
    {
      when: '--pm bun is given',
      args: ['--pm', 'bun'],
      userAgent: 'bun/1.3.0 npm/? node/v24.15.0',
    },
  ])(
    'is left out when $when, since Corepack does not manage npm or bun',
    async ({ args, userAgent }) => {
      const projectDir = await generateProject(args, { npm_config_user_agent: userAgent });

      expect(await readPackageJson(projectDir)).not.toHaveProperty('packageManager');
    },
  );
});

describe('lockfiles', () => {
  it.each(['pnpm', 'npm', 'yarn', 'bun'])(
    'none is written with --pm %s',
    async (packageManager) => {
      const projectDir = await generateProject(['--pm', packageManager, '--type', 'fullstack']);

      expect((await listFiles(projectDir)).filter((file) => LOCKFILE.test(file))).toEqual([]);
    },
  );
});
