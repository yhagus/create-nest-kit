import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createWorkDir, testEnvironment } from '../support/cli.ts';
import { exists } from '../support/project.ts';
import { KEYS, startCli, WIZARD_TEST_TIMEOUT_MS } from '../support/terminal.ts';

const execFileAsync = promisify(execFile);

/** Every option but git, the remote and the CI provider as a flag. */
const ALL_BUT_GIT_AND_CI = (
  '--type api --platform fastify --db postgres --orm drizzle --auth jwt --validation zod ' +
  '--pattern service --layout nested --dev-env local --pm npm --email-verification --csrf ' +
  '--no-install'
).split(' ');

describe('the wizard', { timeout: WIZARD_TEST_TIMEOUT_MS }, () => {
  it('asks for the CI provider even without a git repository', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli(['app', ...ALL_BUT_GIT_AND_CI, '--no-git'], { cwd: workDir });

    await terminal.waitFor('CI provider');
    terminal.press(KEYS.down, KEYS.enter);
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    expect(terminal.output()).not.toContain('Remote URL');
    expect(await exists(path.join(workDir, 'app/.gitlab-ci.yml'))).toBe(true);
  });

  it('registers the remote it asks for after git, and preselects its host as the CI provider', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli(['app', ...ALL_BUT_GIT_AND_CI], { cwd: workDir });

    await terminal.waitFor('Initialize a git repository?');
    terminal.press(KEYS.enter);
    await terminal.waitFor('Remote URL');
    terminal.press('git@gitlab.com:acme/app.git', KEYS.enter);
    await terminal.waitFor('CI provider');
    terminal.press(KEYS.enter);
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    const projectDir = path.join(workDir, 'app');
    expect(await exists(path.join(projectDir, '.gitlab-ci.yml'))).toBe(true);
    const { stdout: origin } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: projectDir,
      env: testEnvironment(),
    });
    expect(origin).toBe('git@gitlab.com:acme/app.git\n');
  });
});
