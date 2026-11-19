import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { listCombos, type Combo } from '../support/combos.ts';
import { REPO_ROOT } from '../support/paths.ts';
import type { CliResult } from '../support/cli.ts';

// `node scripts/matrix.ts --list` prints the combos CI builds its job matrix from.

/** The values of each option the PR subset must pair with every value of every other option. */
const PAIRWISE_OPTIONS: Record<string, string[]> = {
  platform: ['fastify', 'express', 'node'],
  orm: ['drizzle', 'prisma', 'typeorm', 'mikroorm', 'mongoose'],
  auth: ['jwt', 'nest'],
  validation: ['zod', 'class-validator', 'valibot', 'arktype'],
  pattern: ['service', 'cqrs'],
  layout: ['nested', 'flat'],
};

/** `<option>=<value> + <option>=<value>` for every pair of values no combo has together. */
function missingPairs(combos: readonly Combo[]): string[] {
  const options = Object.entries(PAIRWISE_OPTIONS);
  return options.flatMap(([first, firstValues], index) =>
    options
      .slice(index + 1)
      .flatMap(([second, secondValues]) =>
        firstValues.flatMap((firstValue) =>
          secondValues
            .filter(
              (secondValue) =>
                !combos.some(
                  ({ choices }) => choices[first] === firstValue && choices[second] === secondValue,
                ),
            )
            .map((secondValue) => `${first}=${firstValue} + ${second}=${secondValue}`),
        ),
      ),
  );
}

function runMatrixScript(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['scripts/matrix.ts', ...args],
      { cwd: REPO_ROOT },
      (error, stdout, stderr) => {
        resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr });
      },
    );
  });
}

describe('the matrix list', () => {
  it('selects 20 combos for the PR subset, covering every pair of option values', async () => {
    const combos = await listCombos('pr');

    expect(combos).toHaveLength(20);
    expect(missingPairs(combos)).toEqual([]);
  });

  it('filters combos with a glob on the id', async () => {
    const result = await runMatrixScript(['--list', '--only', 'express-*-nest-*']);

    const ids = z.array(z.string()).parse(JSON.parse(result.stdout));
    expect(ids).toHaveLength(80);
    expect(ids.filter((id) => !/^express-.*-nest-/.test(id))).toEqual([]);
  });

  it('applies the glob within the PR subset', async () => {
    const result = await runMatrixScript(['--list', '--subset', 'pr', '--only', '*-mongoose-*']);

    expect(JSON.parse(result.stdout)).toEqual([
      'fastify-mongodb-mongoose-jwt-valibot-service-flat',
      'express-mongodb-mongoose-jwt-arktype-cqrs-flat',
      'express-mongodb-mongoose-nest-zod-service-nested',
      'node-mongodb-mongoose-nest-class-validator-cqrs-nested',
    ]);
  });

  it('rejects an unknown step', async () => {
    const result = await runMatrixScript(['--list', '--steps', 'deploy']);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      '--steps must be one of install, typecheck, build, lint, format:check, test (got "deploy")',
    );
  });
});
