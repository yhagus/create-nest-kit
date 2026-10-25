import { parseDatabaseEnv, type DatabaseEnv } from './database.env.js';
import { InvalidEnvError, type BaseEnv } from './env-contract.js';
import { parseBaseEnv } from './env.schema.js';

export type Env = BaseEnv & DatabaseEnv;

/** Validates raw environment variables; throws listing every invalid one. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const base = parseBaseEnv(source);
  const database = parseDatabaseEnv(source);
  if (!base.success || !database.success) {
    const issues = [base, database].flatMap((result) => (result.success ? [] : result.issues));
    throw new InvalidEnvError(issues);
  }
  return { ...base.env, ...database.env };
}
