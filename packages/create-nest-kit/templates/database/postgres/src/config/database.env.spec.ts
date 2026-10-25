import { describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from './database.env.js';

describe('parseDatabaseEnv', () => {
  it.each(['postgres://app:secret@localhost:5432/app', 'postgresql://localhost/app'])(
    'accepts %s',
    (url) => {
      expect(parseDatabaseEnv({ DATABASE_URL: url })).toEqual({
        success: true,
        env: { DATABASE_URL: url },
      });
    },
  );

  it.each([undefined, 'mysql://localhost/app', 'not a url'])('refuses %s', (url) => {
    expect(parseDatabaseEnv({ DATABASE_URL: url })).toEqual({
      success: false,
      issues: [{ key: 'DATABASE_URL', message: expect.any(String) }],
    });
  });
});
