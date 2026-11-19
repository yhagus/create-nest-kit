import { Controller, Get, Module } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../../src/auth/decorators.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

/** A route that fails the way a lost database connection would. */
@Controller('probe')
class FailingController {
  @Public()
  @Get('crash')
  crash(): never {
    throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
  }
}

@Module({ controllers: [FailingController] })
class FailingModule {}

describe('error bodies', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({}, { extraImports: [FailingModule] });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('answer a malformed JSON body with 400 BAD_REQUEST', async () => {
    const response = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email": ',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      message: expect.any(String),
    });
  });

  it('answer an unknown route with 404 NOT_FOUND', async () => {
    const response = await fetch(`${testApp.baseUrl}/api/v1/does-not-exist`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('hide the message of an unexpected error behind 500 INTERNAL_ERROR', async () => {
    const response = await request(testApp, 'GET /probe/crash');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
