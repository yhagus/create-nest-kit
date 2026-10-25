import { describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from './database.env.js';

describe('parseDatabaseEnv', () => {
  it.each([
    'mongodb://a:27017,b:27017/app?replicaSet=rs0',
    'mongodb+srv://cluster.example.com/app',
  ])('accepts %s', (uri) => {
    expect(parseDatabaseEnv({ MONGODB_URI: uri })).toEqual({
      success: true,
      env: { MONGODB_URI: uri },
    });
  });

  it.each([undefined, 'postgres://localhost/app'])('refuses %s', (uri) => {
    expect(parseDatabaseEnv({ MONGODB_URI: uri })).toEqual({
      success: false,
      issues: [{ key: 'MONGODB_URI', message: expect.any(String) }],
    });
  });
});
