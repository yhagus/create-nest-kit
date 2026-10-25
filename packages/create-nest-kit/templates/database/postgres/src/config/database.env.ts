import type { EnvParseResult } from './env-contract.js';

export interface DatabaseEnv {
  DATABASE_URL: string;
}

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(['postgres:', 'postgresql:']);

/** Read alongside the app's env in env.ts; plain code, so it is the same for every validation library. */
export function parseDatabaseEnv(
  source: Record<string, string | undefined>,
): EnvParseResult<DatabaseEnv> {
  const url = source['DATABASE_URL'];
  if (url === undefined || !isPostgresUrl(url)) {
    const message = 'expected a postgres:// or postgresql:// URL';
    return { success: false, issues: [{ key: 'DATABASE_URL', message }] };
  }
  return { success: true, env: { DATABASE_URL: url } };
}

function isPostgresUrl(value: string): boolean {
  return URL.canParse(value) && POSTGRES_PROTOCOLS.has(new URL(value).protocol);
}
