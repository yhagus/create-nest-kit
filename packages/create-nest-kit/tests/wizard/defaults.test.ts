import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorkDir, generateProject } from '../support/cli.ts';
import { listFiles, readJsonFile } from '../support/project.ts';
import { KEYS, startCli, type Terminal, WIZARD_TEST_TIMEOUT_MS } from '../support/terminal.ts';

// pnpm "launched" the CLI, so the wizard doesn't ask for the package manager either.
const LAUNCHED_BY_PNPM = { npm_config_user_agent: 'pnpm/10.12.1 npm/? node/v24.15.0 linux x64' };

/** Every prompt the wizard shows when no option is given as a flag, in order. */
const PROMPTS = [
  'Project name: a new folder here, or . for this folder',
  'Project type',
  'HTTP platform',
  'Database',
  'ORM',
  'Auth style',
  'Validation library',
  'Application pattern',
  'Folder layout',
  'Require email verification before login?',
  'Enable CSRF protection?',
  'Dev environment',
];

/** Answers each prompt, in order, with its preselected value. */
async function acceptEach(terminal: Terminal, prompts: readonly string[]): Promise<void> {
  for (const prompt of prompts) {
    await terminal.waitFor(prompt);
    terminal.press(KEYS.enter);
  }
}

describe('the wizard', { timeout: WIZARD_TEST_TIMEOUT_MS }, () => {
  it('generates what --yes generates when every default is accepted', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli(['--no-install', '--no-git'], {
      cwd: workDir,
      env: LAUNCHED_BY_PNPM,
    });

    await acceptEach(terminal, PROMPTS);
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    expect(terminal.output()).toContain('Happy hacking!');
    const projectDir = path.join(workDir, 'nest-api');
    const withYes = await generateProject([], LAUNCHED_BY_PNPM);
    expect(await listFiles(projectDir)).toEqual(await listFiles(withYes));
    expect(await readJsonFile(projectDir, 'package.json')).toEqual({
      ...z
        .object({})
        .loose()
        .parse(await readJsonFile(withYes, 'package.json')),
      name: 'nest-api',
    });
  });
});
