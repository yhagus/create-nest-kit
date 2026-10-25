import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

const REQUEST_ID_HEADER = 'x-request-id';
/** Ids from the outside end up in every log line, so only short, plain ones are kept. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/** The caller's `X-Request-Id` when it is safe to log, else a new UUID. */
export function genReqId(request: { headers: IncomingHttpHeaders }): string {
  const header = request.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && SAFE_REQUEST_ID.test(header) ? header : randomUUID();
}
