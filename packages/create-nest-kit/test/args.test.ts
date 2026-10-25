import { describe, expect, it } from 'vitest';
import { parseCliArgs, UsageError } from '../src/args.ts';

describe('parseCliArgs', () => {
  it('maps every choice flag to its option', () => {
    const args = parseCliArgs([
      'my-api',
      '--platform',
      'express',
      '--db',
      'postgres',
      '--orm',
      'prisma',
      '--auth',
      'nest',
      '--validation',
      'valibot',
      '--no-email-verification',
      '--csrf',
      '--pm',
      'pnpm',
      '--no-install',
      '--no-git',
    ]);

    expect(args.directory).toBe('my-api');
    expect(args.choices).toEqual({
      platform: 'express',
      database: 'postgres',
      orm: 'prisma',
      auth: 'nest',
      validation: 'valibot',
      emailVerification: false,
      csrf: true,
      packageManager: 'pnpm',
      install: false,
      git: false,
    });
  });

  it('leaves choices that were not given undefined, so they are prompted for', () => {
    expect(parseCliArgs([]).choices).toEqual({
      platform: undefined,
      database: undefined,
      orm: undefined,
      auth: undefined,
      validation: undefined,
      emailVerification: undefined,
      csrf: undefined,
      packageManager: undefined,
      install: undefined,
      git: undefined,
    });
  });

  it('maps the control flags', () => {
    expect(parseCliArgs(['-y', '--force', '--dry-run'])).toMatchObject({
      acceptDefaults: true,
      allowNonEmptyDirectory: true,
      isDryRun: true,
      showHelp: false,
      showVersion: false,
    });
  });

  it('rejects an unknown choice and lists the allowed ones', () => {
    expect(() => parseCliArgs(['--db', 'mysql'])).toThrow(
      new UsageError('--db must be one of postgres, mongodb (got "mysql")'),
    );
  });

  it('rejects an ORM that does not fit the database before prompting', () => {
    expect(() => parseCliArgs(['--db', 'mongodb', '--orm', 'drizzle'])).toThrow(
      '--orm drizzle is not available for MongoDB',
    );
  });

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['--database', 'postgres'])).toThrow(UsageError);
  });

  it('rejects more than one directory', () => {
    expect(() => parseCliArgs(['a', 'b'])).toThrow('Expected at most one directory');
  });
});
