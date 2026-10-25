import { describe, expect, it } from 'vitest';
import { UsageError } from '../src/args.ts';
import {
  nonInteractivePackageName,
  packageNameStep,
  shellQuote,
  shortenHomePath,
  toValidPackageName,
} from '../src/project-target.ts';

describe('toValidPackageName', () => {
  it('lower-cases and turns spaces into dashes', () => {
    expect(toValidPackageName('My Apps')).toBe('my-apps');
  });

  it('replaces invalid characters and collapses the dashes they leave', () => {
    expect(toValidPackageName('Billing API (v2)!')).toBe('billing-api-v2');
  });

  it('strips a leading dot or underscore', () => {
    expect(toValidPackageName('._internal_tools')).toBe('internal_tools');
  });

  it('falls back to nest-api when nothing valid is left', () => {
    expect(toValidPackageName('***')).toBe('nest-api');
  });
});

describe('packageNameStep', () => {
  it('names the package after the new folder inside the current one', () => {
    expect(packageNameStep('/code/apps', 'billing-api', undefined)).toEqual({
      kind: 'known',
      name: 'billing-api',
    });
  });

  it('uses the last segment of a nested path', () => {
    expect(packageNameStep('/code/apps', 'services/billing-api', undefined)).toEqual({
      kind: 'known',
      name: 'billing-api',
    });
  });

  it('asks for a name when "." points at a folder whose name is not a valid package name', () => {
    expect(packageNameStep('/code/My Apps', '.', undefined)).toEqual({
      kind: 'ask',
      folderName: 'My Apps',
      problem: 'it contains capital letters',
      suggestion: 'my-apps',
    });
  });

  it('asks for a name when the typed folder name is not a valid package name', () => {
    expect(packageNameStep('/code/apps', 'MyApi', undefined)).toMatchObject({
      kind: 'ask',
      suggestion: 'myapi',
    });
  });

  it('takes --name over the folder name', () => {
    expect(packageNameStep('/code/My Apps', '.', 'billing')).toEqual({
      kind: 'known',
      name: 'billing',
    });
  });
});

describe('nonInteractivePackageName', () => {
  it('fails on an invalid folder name and suggests --name with a cleaned-up name', () => {
    expect(() => nonInteractivePackageName('/code/My Apps', '.', undefined)).toThrow(
      new UsageError(
        '"My Apps" can\'t be a package name: it contains capital letters. Pass --name my-apps (or another valid npm package name).',
      ),
    );
  });

  it('uses --name when the folder name is invalid', () => {
    expect(nonInteractivePackageName('/code/My Apps', '.', 'my-apps')).toBe('my-apps');
  });
});

describe('shortenHomePath', () => {
  it('writes a path inside the home directory with ~', () => {
    expect(shortenHomePath('/Users/ana/code/apps', '/Users/ana')).toBe('~/code/apps');
  });

  it('leaves a path outside the home directory as is', () => {
    expect(shortenHomePath('/Users/anabel/apps', '/Users/ana')).toBe('/Users/anabel/apps');
  });
});

describe('shellQuote', () => {
  it('leaves a plain path as is', () => {
    expect(shellQuote('services/billing-api')).toBe('services/billing-api');
  });

  it('quotes a path with spaces, so `cd` gets one argument', () => {
    expect(shellQuote('My Api')).toBe("'My Api'");
  });

  it('escapes single quotes inside the quoted word', () => {
    expect(shellQuote("Ada's api")).toBe(`'Ada'\\''s api'`);
  });
});
