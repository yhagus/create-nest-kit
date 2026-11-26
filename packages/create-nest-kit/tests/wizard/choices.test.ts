import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkDir } from '../support/cli.ts';
import { readPackageJson } from '../support/project.ts';
import { KEYS, startCli, WIZARD_TEST_TIMEOUT_MS } from '../support/terminal.ts';

/** Every option but the database and ORM as a flag, so the wizard asks only for what a test is about. */
const ALL_BUT_DATABASE = (
  '--type api --platform fastify --auth jwt --validation zod --pattern service --layout nested ' +
  '--dev-env local --pm npm --email-verification --csrf --no-install --no-git --ci github'
).split(' ');
const ALL_OPTIONS = [...ALL_BUT_DATABASE, '--db', 'postgres', '--orm', 'drizzle'];

describe('the wizard', { timeout: WIZARD_TEST_TIMEOUT_MS }, () => {
  it('picks Mongoose for MongoDB without asking, with a note saying so', async () => {
    const workDir = await createWorkDir();
    const terminal = startCli(['app', ...ALL_BUT_DATABASE], { cwd: workDir });

    await terminal.waitFor('Database');
    terminal.press(KEYS.down, KEYS.enter);
    await terminal.waitFor('MongoDB uses Mongoose.');
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    // The ORM prompt would list Drizzle first.
    expect(terminal.output()).not.toContain('Drizzle');
    expect((await readPackageJson(path.join(workDir, 'app'))).dependencies).toHaveProperty(
      'mongoose',
    );
  });

  it('asks for a package name when the folder name is not one, suggesting a cleaned-up name', async () => {
    const workDir = await createWorkDir();
    const projectDir = path.join(workDir, 'My Apps');
    await mkdir(projectDir);
    const terminal = startCli(['.', ...ALL_OPTIONS], { cwd: projectDir });

    await terminal.waitFor(`"My Apps" can't be a package name: it contains capital letters.`);
    await terminal.waitFor('Package name');
    await terminal.waitFor('my-apps');
    terminal.press(KEYS.enter);
    await terminal.waitFor('Create the project?');
    terminal.press(KEYS.enter);

    expect(await terminal.waitForExit()).toBe(0);
    expect(await readPackageJson(projectDir)).toMatchObject({ name: 'my-apps' });
  });
});
