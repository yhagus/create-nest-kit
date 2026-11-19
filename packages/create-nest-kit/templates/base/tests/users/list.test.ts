import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, seedAdmin, type SignedInUser } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('GET /users', () => {
  let testApp: TestApp;
  let admin: SignedInUser;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    admin = await seedAdmin(testApp);
  });

  it('lists one page of users by email, with the total', async () => {
    // Created out of email order, so a list in creation order would put bob last.
    await createUser(testApp, { email: 'carol@example.com' });
    await createUser(testApp, { email: 'bob@example.com' });

    const response = await request(testApp, 'GET /users?page=2&limit=2', {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [expect.objectContaining({ email: 'carol@example.com' })],
      total: 3,
      page: 2,
      limit: 2,
    });
  });

  it('searches the email and the name, ignoring case', async () => {
    await createUser(testApp, { email: 'ada@example.com', name: 'Ada Lovelace' });
    await createUser(testApp, { email: 'lovelace.fan@example.com', name: 'Fan' });
    await createUser(testApp, { email: 'grace@example.com', name: 'Grace Hopper' });

    const response = await request(testApp, 'GET /users?search=LOVELACE', {
      accessToken: admin.accessToken,
    });

    expect(await response.json()).toMatchObject({
      items: [{ email: 'ada@example.com' }, { email: 'lovelace.fan@example.com' }],
      total: 2,
    });
  });

  it('treats % and _ in a search as plain characters', async () => {
    // As wildcards, `%` would match every user and `e_h` would match "Grace Hopper" too.
    await createUser(testApp, { email: 'ada@example.com', name: 'Ada Lovelace_Hopper 100%' });
    await createUser(testApp, { email: 'grace@example.com', name: 'Grace Hopper' });

    const percent = await request(testApp, `GET /users?search=${encodeURIComponent('%')}`, {
      accessToken: admin.accessToken,
    });
    const underscore = await request(testApp, 'GET /users?search=e_h', {
      accessToken: admin.accessToken,
    });

    expect(await percent.json()).toMatchObject({ items: [{ email: 'ada@example.com' }], total: 1 });
    expect(await underscore.json()).toMatchObject({
      items: [{ email: 'ada@example.com' }],
      total: 1,
    });
  });

  it('returns the first page of 20 when no page is given', async () => {
    const response = await request(testApp, 'GET /users', { accessToken: admin.accessToken });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 1, page: 1, limit: 20 });
  });

  it('refuses a page size over 100', async () => {
    const response = await request(testApp, 'GET /users?limit=101', {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'limit', errors: expect.any(Array) }],
    });
  });

  it('refuses unknown query parameters, naming them', async () => {
    const response = await request(testApp, 'GET /users?sort=name', {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'sort', errors: expect.any(Array) }],
    });
  });
});
