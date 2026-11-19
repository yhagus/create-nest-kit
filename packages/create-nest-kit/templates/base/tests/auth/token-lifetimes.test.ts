import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  refresh,
  seedSystemRoles,
} from '../support/auth.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

// Each wait leaves at least 1.5 s between a refresh and the deadline it must beat, and passes a
// deadline by at least a second, so a slow machine can't turn these red.

// JWT expiry has a resolution of one second, so waits are a little over two.
const PAST_TWO_SECONDS_MS = 2_100;
const LIFETIME_TEST_TIMEOUT_MS = 20_000;

describe('with a one-second access token', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ ACCESS_TOKEN_TTL: '1s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('rejects the access token once it expires, while refresh still works', async () => {
    const { accessToken, refreshToken } = await createSignedInUser(testApp);

    await sleep(PAST_TWO_SECONDS_MS);

    await expectAccessTokenRefused(testApp, accessToken);
    // `refresh` asserts the 200. The renewed one-second token isn't checked: JWT expiry counts
    // whole seconds, so a token issued just before a second boundary can already be expired.
    const renewed = await refresh(testApp, refreshToken);
    expect(renewed.accessToken).not.toBe(accessToken);
  });
});

describe('with a four-second sliding refresh lifetime', () => {
  const WITHIN_LIFETIME_MS = 2_500;
  const PAST_LIFETIME_MS = 5_000;
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ REFRESH_TOKEN_TTL: '4s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it(
    'extends the session on each refresh and ends it when unused for longer',
    async () => {
      const { refreshToken } = await createSignedInUser(testApp);

      await sleep(WITHIN_LIFETIME_MS);
      const renewed = await refresh(testApp, refreshToken);
      // Past the login's original expiry, so this refresh works only if the first one extended it.
      await sleep(WITHIN_LIFETIME_MS);
      const renewedAgain = await refresh(testApp, renewed.refreshToken);
      await sleep(PAST_LIFETIME_MS);

      await expectRefreshTokenRefused(testApp, renewedAgain.refreshToken);
    },
    LIFETIME_TEST_TIMEOUT_MS,
  );
});

describe('with a three-second absolute session lifetime', () => {
  const WITHIN_LIFETIME_MS = 1_500;
  const PAST_LIFETIME_MS = 2_500;
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ SESSION_ABSOLUTE_TTL: '3s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it(
    'ends the session at its absolute expiry however often it is refreshed',
    async () => {
      const { refreshToken } = await createSignedInUser(testApp);

      await sleep(WITHIN_LIFETIME_MS);
      const renewed = await refresh(testApp, refreshToken);
      await sleep(PAST_LIFETIME_MS);

      await expectRefreshTokenRefused(testApp, renewed.refreshToken);
    },
    LIFETIME_TEST_TIMEOUT_MS,
  );
});
