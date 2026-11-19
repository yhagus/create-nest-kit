import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { parseEnvFile, readProjectFile } from '../support/project.ts';

const SECRET_KEYS = ['COOKIE_SECRET', 'JWT_SECRET', 'SEED_ADMIN_PASSWORD'] as const;
/** 48 random bytes in base64url. */
const GENERATED_SECRET = /^[\w-]{64}$/;

describe('.env and .env.example', () => {
  it('declare the same variables, grouped by the layer that needs them', async () => {
    const projectDir = await generateProject();

    const env = await readProjectFile(projectDir, '.env');
    const example = await readProjectFile(projectDir, '.env.example');
    expect(Object.keys(parseEnvFile(env))).toEqual(Object.keys(parseEnvFile(example)));
    expect(example).toMatch(/^# --- base ---\n/);
    expect(example).toContain('\n# --- database/postgres ---\nDATABASE_URL=');
    expect(parseEnvFile(env)).toMatchObject({ APP_NAME: 'app', PORT: '3000' });
  });

  it('generate a distinct random secret for each secret in .env only', async () => {
    const projectDir = await generateProject();

    const env = parseEnvFile(await readProjectFile(projectDir, '.env'));
    const example = parseEnvFile(await readProjectFile(projectDir, '.env.example'));
    const secrets = SECRET_KEYS.map((key) => env[key]);
    expect(secrets).toEqual(SECRET_KEYS.map(() => expect.stringMatching(GENERATED_SECRET)));
    expect(new Set(secrets).size).toBe(SECRET_KEYS.length);
    expect(example).toMatchObject({
      COOKIE_SECRET: 'change-me-to-at-least-32-characters',
      JWT_SECRET: 'change-me-to-at-least-32-characters',
      SEED_ADMIN_PASSWORD: 'change-me',
    });
  });

  it('get new secrets in every project', async () => {
    const first = parseEnvFile(await readProjectFile(await generateProject(), '.env'));
    const second = parseEnvFile(await readProjectFile(await generateProject(), '.env'));

    expect(first.JWT_SECRET).not.toBe(second.JWT_SECRET);
  });
});
