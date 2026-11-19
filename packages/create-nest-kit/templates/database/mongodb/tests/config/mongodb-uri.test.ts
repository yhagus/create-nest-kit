import { describe, expect, it } from 'vitest';
import { createTestApp } from '../support/test-app.js';

describe('MONGODB_URI', () => {
  it('refuses a URL of another database', async () => {
    await expect(createTestApp({ MONGODB_URI: 'postgres://localhost/app' })).rejects.toThrow(
      /MONGODB_URI/,
    );
  });
});
