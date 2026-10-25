import type { EnvParseResult } from './env-contract.js';

export interface DatabaseEnv {
  MONGODB_URI: string;
}

/**
 * A MongoDB connection string. Not parsed as a URL: a replica set URI lists several hosts
 * (`mongodb://a:27017,b:27017/app`), which isn't a valid URL.
 */
const MONGODB_URI_PATTERN = /^mongodb(\+srv)?:\/\/.+/;

/** Read alongside the app's env in env.ts; plain code, so it is the same for every validation library. */
export function parseDatabaseEnv(
  source: Record<string, string | undefined>,
): EnvParseResult<DatabaseEnv> {
  const uri = source['MONGODB_URI'];
  if (uri === undefined || !MONGODB_URI_PATTERN.test(uri)) {
    const message = 'expected mongodb://… or mongodb+srv://…';
    return { success: false, issues: [{ key: 'MONGODB_URI', message }] };
  }
  return { success: true, env: { MONGODB_URI: uri } };
}
