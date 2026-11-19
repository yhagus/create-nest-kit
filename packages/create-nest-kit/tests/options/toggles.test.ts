import { describe, expect, it } from 'vitest';
import { generateProject } from '../support/cli.ts';
import { parseEnvFile, readProjectFile } from '../support/project.ts';

async function readEnvFiles(projectDir: string) {
  return {
    env: parseEnvFile(await readProjectFile(projectDir, '.env')),
    example: parseEnvFile(await readProjectFile(projectDir, '.env.example')),
  };
}

describe('email verification and CSRF', () => {
  it('are on by default in .env and .env.example', async () => {
    const projectDir = await generateProject();

    const { env, example } = await readEnvFiles(projectDir);
    const expected = { EMAIL_VERIFICATION_ENABLED: 'true', CSRF_ENABLED: 'true' };
    expect(env).toMatchObject(expected);
    expect(example).toMatchObject(expected);
  });

  it('are turned off with --no-email-verification and --no-csrf', async () => {
    const projectDir = await generateProject(['--no-email-verification', '--no-csrf']);

    const { env, example } = await readEnvFiles(projectDir);
    const expected = { EMAIL_VERIFICATION_ENABLED: 'false', CSRF_ENABLED: 'false' };
    expect(env).toMatchObject(expected);
    expect(example).toMatchObject(expected);
  });
});
