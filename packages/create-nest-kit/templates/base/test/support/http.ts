import type { TestApp } from './app.js';

const API_PREFIX = '/api/v1';

export interface RequestOptions {
  body?: unknown;
  /** Sent as `Authorization: Bearer <accessToken>`. */
  accessToken?: string;
  headers?: Record<string, string>;
}

/**
 * Calls the API like a client would: `request(testApp, 'POST /auth/login', { body })`.
 * Paths are relative to /api/v1, as in docs/contract.md; bodies are sent as JSON.
 */
export function request(
  testApp: TestApp,
  route: `${string} /${string}`,
  { body, accessToken, headers = {} }: RequestOptions = {},
): Promise<Response> {
  const separator = route.indexOf(' ');
  const method = route.slice(0, separator);
  const path = route.slice(separator + 1);
  const allHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) allHeaders['content-type'] = 'application/json';
  if (accessToken !== undefined) allHeaders['authorization'] = `Bearer ${accessToken}`;
  return fetch(`${testApp.baseUrl}${API_PREFIX}${path}`, {
    method,
    headers: allHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The `Set-Cookie` header the response sent for `name`, e.g. `refresh_token=…; Path=…`. */
export function setCookieHeader(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
}

/** The value of the cookie `name` set by the response, ready to send back in a `Cookie` header. */
export function cookieValue(response: Response, name: string): string | undefined {
  const header = setCookieHeader(response, name);
  return header?.slice(name.length + 1).split(';')[0];
}
