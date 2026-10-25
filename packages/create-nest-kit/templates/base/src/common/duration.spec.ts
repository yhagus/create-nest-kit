import { describe, expect, it } from 'vitest';
import { parseDuration } from './duration.js';

describe('parseDuration', () => {
  it.each([
    ['45s', 45_000],
    ['15m', 900_000],
    ['24h', 86_400_000],
    ['30d', 2_592_000_000],
  ])('reads %s as %i milliseconds', (value, milliseconds) => {
    expect(parseDuration(value)).toBe(milliseconds);
  });

  it.each(['15', '1w', '-1m', '1.5h', 'm', ''])('rejects %j', (value) => {
    expect(() => parseDuration(value)).toThrow(/duration/);
  });
});
