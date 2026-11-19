import { CreateSessionHandler } from './create-session.handler.js';
import { RevokeAllUserSessionsHandler } from './revoke-all-user-sessions.handler.js';
import { RevokeSessionHandler } from './revoke-session.handler.js';
import { RevokeUserSessionHandler } from './revoke-user-session.handler.js';
import { TouchSessionHandler } from './touch-session.handler.js';

export const CommandHandlers = [
  CreateSessionHandler,
  RevokeAllUserSessionsHandler,
  RevokeSessionHandler,
  RevokeUserSessionHandler,
  TouchSessionHandler,
];
