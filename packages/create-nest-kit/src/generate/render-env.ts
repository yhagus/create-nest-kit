import { randomBytes } from 'node:crypto';
import type { MergedManifest, ResolvedEnvVar } from '../layers/merge.ts';

const SECRET_BYTES = 48;

export type SecretGenerator = () => string;

export const generateRandomSecret: SecretGenerator = () =>
  randomBytes(SECRET_BYTES).toString('base64url');

/** `.env.example`: committed, so secrets keep their placeholder value. */
export function renderEnvExample(manifest: MergedManifest): string {
  return renderEnvFile(manifest, (envVar) => envVar.value);
}

/** `.env`: local only, so every secret gets a fresh random value. */
export function renderEnv(
  manifest: MergedManifest,
  generateSecret: SecretGenerator = generateRandomSecret,
): string {
  return renderEnvFile(manifest, (envVar) => (envVar.isSecret ? generateSecret() : envVar.value));
}

function renderEnvFile(
  manifest: MergedManifest,
  valueOf: (envVar: ResolvedEnvVar) => string,
): string {
  const groups = manifest.envGroups.map((group) => {
    const lines = [`# --- ${group.layerId} ---`];
    for (const envVar of group.vars) {
      if (envVar.comment) lines.push(`# ${envVar.comment}`);
      lines.push(`${envVar.key}=${formatEnvValue(valueOf(envVar))}`);
    }
    return lines.join('\n');
  });
  return `${groups.join('\n\n')}\n`;
}

/** Characters that never need quoting in a dotenv file. */
const UNQUOTED_ENV_VALUE = /^[\w.,:/@+\-?&%=]*$/;

function formatEnvValue(value: string): string {
  return UNQUOTED_ENV_VALUE.test(value) ? value : JSON.stringify(value);
}
