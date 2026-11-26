import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createWorkDir, runCli } from '../support/cli.ts';

// None of these pass --yes: a command line the CLI can't act on fails before any prompt.
describe('a command line the CLI cannot act on', () => {
  it.each([
    {
      problem: 'a SQL ORM on MongoDB',
      args: ['--db', 'mongodb', '--orm', 'drizzle'],
      message: '--orm drizzle is not available for MongoDB; use --orm mongoose or --db postgres',
    },
    {
      problem: 'Mongoose on PostgreSQL',
      args: ['--db', 'postgres', '--orm', 'mongoose'],
      message:
        '--orm mongoose is not available for PostgreSQL; use --orm drizzle | prisma | typeorm | mikroorm or --db mongodb',
    },
    {
      problem: 'an unknown choice',
      args: ['--platform', 'koa'],
      message: '--platform must be one of fastify, express, node (got "koa")',
    },
    {
      problem: 'an invalid package name',
      args: ['--name', 'My App'],
      message: '--name "My App" is not a valid npm package name: it contains capital letters',
    },
    {
      problem: 'a remote without a repository',
      args: ['--remote', 'git@github.com:acme/app.git', '--no-git'],
      message: '--remote needs a git repository; drop --remote or --no-git',
    },
    {
      problem: 'a remote with whitespace in it',
      args: ['--remote', 'git@github.com:acme/my app.git'],
      message:
        '--remote "git@github.com:acme/my app.git" is not a valid git remote: it contains whitespace',
    },
    {
      problem: 'an unknown flag',
      args: ['--frobnicate'],
      message: "Unknown option '--frobnicate'",
    },
    {
      problem: 'two directories',
      args: ['one', 'two'],
      message: 'Expected at most one directory, got: one two',
    },
  ])('fails on $problem with a hint, writing nothing', async ({ args, message }) => {
    const workDir = await createWorkDir();

    const result = await runCli(args, { cwd: workDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/^Error: /);
    expect(result.stderr).toContain(message);
    expect(result.stdout).toBe('');
    expect(await readdir(workDir)).toEqual([]);
  });
});
