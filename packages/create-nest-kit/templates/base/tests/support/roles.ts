import { expect } from 'vitest';
import { request } from './http.js';
import { expectShape, isRecord } from './json.js';
import type { TestApp } from './test-app.js';

function hasId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value['id'] === 'string';
}

/** `POST /roles` as the caller of `accessToken`, expecting success; returns the role's id. */
export async function createRole(
  testApp: TestApp,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await request(testApp, 'POST /roles', { accessToken, body });
  expect(response.status).toBe(201);
  return expectShape(await response.json(), hasId, 'a role').id;
}
