import { IsSessionRevokedHandler } from './is-session-revoked.handler.js';
import { ListActiveSessionsHandler } from './list-active-sessions.handler.js';

export const QueryHandlers = [IsSessionRevokedHandler, ListActiveSessionsHandler];
