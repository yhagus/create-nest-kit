import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decodeAccessToken,
  signAccessToken,
  unsignedAccessToken,
} from '../support/access-token.js';
import {
  createSignedInUser,
  currentSessionId,
  expectAccessTokenRefused,
  seedSystemRoles,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

/** The default ACCESS_TOKEN_TTL, 15m. */
const FIFTEEN_MINUTES_IN_SECONDS = 15 * 60;
const OTHER_SECRET = 'another-jwt-secret-of-at-least-32-characters';

describe('access tokens', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('carry the user, the current session and the access token lifetime', async () => {
    const { user, accessToken } = await createSignedInUser(testApp);

    const claims = decodeAccessToken(accessToken);

    expect(claims.sub).toBe(user.id);
    expect(claims.sid).toBe(await currentSessionId(testApp, accessToken));
    expect(claims.exp - claims.iat).toBe(FIFTEEN_MINUTES_IN_SECONDS);
  });

  it('are refused when signed with another secret', async () => {
    const { accessToken } = await createSignedInUser(testApp);

    const forged = signAccessToken(decodeAccessToken(accessToken), OTHER_SECRET);

    await expectAccessTokenRefused(testApp, forged);
  });

  it('are refused unsigned (alg none)', async () => {
    const { accessToken } = await createSignedInUser(testApp);

    const forged = unsignedAccessToken(decodeAccessToken(accessToken));

    await expectAccessTokenRefused(testApp, forged);
  });

  it('are refused when malformed', async () => {
    const response = await request(testApp, 'GET /auth/me', { accessToken: 'not.a.jwt' });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
  });
});
