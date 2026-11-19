import { describe, expect, inject, it, onTestFinished } from 'vitest';
import { createTestApp } from '../support/test-app.js';

describe('DATABASE_URL', () => {
  it('may use the postgresql:// scheme', async () => {
    const { DATABASE_URL = '' } = inject('databaseEnv');

    const testApp = await createTestApp({
      DATABASE_URL: DATABASE_URL.replace(/^postgres:/, 'postgresql:'),
    });
    onTestFinished(() => testApp.close());

    const health = await fetch(`${testApp.baseUrl}/health`);
    expect(health.status).toBe(200);
  });

  it('refuses a URL of another database', async () => {
    await expect(createTestApp({ DATABASE_URL: 'mysql://localhost/app' })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });
});
