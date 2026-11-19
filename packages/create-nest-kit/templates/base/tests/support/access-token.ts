import { createHmac } from 'node:crypto';
import { expectShape, isRecord } from './json.js';

// Just enough JWT handling to read and forge access tokens, without a JWT library: only the
// hand-rolled auth style ships one, and the tests must run unchanged in both styles.

/** The claims docs/contract.md requires, plus whatever else the auth style adds. */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  [claim: string]: unknown;
}

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  return (
    isRecord(value) &&
    typeof value['sub'] === 'string' &&
    typeof value['sid'] === 'string' &&
    typeof value['iat'] === 'number' &&
    typeof value['exp'] === 'number'
  );
}

/** The claims of `accessToken`, read without checking its signature. */
export function decodeAccessToken(accessToken: string): AccessTokenClaims {
  const payload = accessToken.split('.')[1];
  if (payload === undefined) throw new Error('The access token is not a JWT');
  const json: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return expectShape(json, isAccessTokenClaims, 'access token claims');
}

/** A JWT carrying `claims`, signed with HS256 and `secret`. */
export function signAccessToken(claims: AccessTokenClaims, secret: string): string {
  const unsigned = `${encodeSegment({ alg: 'HS256', typ: 'JWT' })}.${encodeSegment(claims)}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

/** A JWT carrying `claims` with `alg: none` and an empty signature. */
export function unsignedAccessToken(claims: AccessTokenClaims): string {
  return `${encodeSegment({ alg: 'none', typ: 'JWT' })}.${encodeSegment(claims)}.`;
}

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
