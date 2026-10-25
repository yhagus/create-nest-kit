import { describe, expect, it } from 'vitest';
import { parseRateLimit } from './rate-limit.js';

describe('parseRateLimit', () => {
  it('reads a limit per duration', () => {
    expect(parseRateLimit('3/15m')).toEqual({ limit: 3, ttl: 900_000 });
  });

  it.each(['3', '3/15', '/15m', '3/15w', '3 / 15m'])('rejects %j', (value) => {
    expect(() => parseRateLimit(value)).toThrow(/rate limit/);
  });
});
