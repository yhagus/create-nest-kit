import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkDir } from '../support/cli.ts';
import { KEYS, startCli, WIZARD_TEST_TIMEOUT_MS } from '../support/terminal.ts';

/** Every option as a flag: the wizard only confirms the target folder and the summary. */
const ALL_OPTIONS = (
  '--type api --platform fastify --db postgres --orm drizzle --auth jwt --validation zod ' +
  '--pattern service --layout nested --dev-env local --pm npm --email-verification --csrf ' +
  '--no-install --no-git'
).split(' ');

describe('cancelling the wizard', { timeout: WIZARD_TEST_TIMEOUT_MS }, () => {
  it('with Ctrl-C at the first prompt writes nothing', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli([], { cwd: workDir });

    await terminal.waitFor('Project name');
    terminal.press(KEYS.ctrlC);

    expect(await terminal.waitForExit()).toBe(0);
    expect(terminal.output()).toContain('Cancelled. Nothing was written.');
    expect(await readdir(workDir)).toEqual([]);
  });

  it('with Ctrl-C at the summary, once everything is answered, writes nothing', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli(['app', ...ALL_OPTIONS], { cwd: workDir });

    await terminal.waitFor('Summary');
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.ctrlC);

    expect(await terminal.waitForExit()).toBe(0);
    expect(terminal.output()).toContain('Cancelled. Nothing was written.');
    expect(await readdir(workDir)).toEqual([]);
  });

  it('by declining to write into a non-empty folder leaves it untouched', async () => {
    const workDir = await createWorkDir();
    await mkdir(path.join(workDir, 'app'));
    await writeFile(path.join(workDir, 'app/notes.txt'), 'keep me');
    const terminal = startCli(['app', ...ALL_OPTIONS], { cwd: workDir });

    await terminal.waitFor('Write into it anyway?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    expect(terminal.output()).toContain('Cancelled. Nothing was written.');
    expect(await readdir(path.join(workDir, 'app'))).toEqual(['notes.txt']);
  });
});
