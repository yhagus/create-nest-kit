import { Controller, Get, Module } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedAdmin } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

/** A route whose author forgot the access decorator. */
@Controller('probe')
class ProbeController {
  @Get('undecorated')
  undecorated(): { reached: true } {
    return { reached: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('a handler without an access decorator', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({}, { extraImports: [ProbeModule] });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  it('is refused with 403 even to an admin', async () => {
    const { accessToken } = await seedAdmin(testApp);

    const response = await request(testApp, 'GET /probe/undecorated', { accessToken });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_FORBIDDEN' });
  });

  it('is refused with 401 to anonymous callers', async () => {
    const response = await request(testApp, 'GET /probe/undecorated');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
  });
});
