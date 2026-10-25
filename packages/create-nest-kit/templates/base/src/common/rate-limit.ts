import { parseDuration } from './duration.js';

/** `<limit>/<duration>`, e.g. `10/1m` or `3/15m`; the duration as in `DURATION_PATTERN`. */
export const RATE_LIMIT_PATTERN = /^(\d+)\/(\d+[smhd])$/;

export interface RateLimit {
  limit: number;
  /** The window, in milliseconds. */
  ttl: number;
}

/** `'10/1m'` → `{ limit: 10, ttl: 60000 }`. Throws on anything that doesn't match `RATE_LIMIT_PATTERN`. */
export function parseRateLimit(value: string): RateLimit {
  const [, limit, window] = RATE_LIMIT_PATTERN.exec(value) ?? [];
  if (limit === undefined || window === undefined) {
    throw new Error(`Invalid rate limit "${value}": expected <limit>/<duration>, e.g. 10/1m`);
  }
  return { limit: Number(limit), ttl: parseDuration(window) };
}
