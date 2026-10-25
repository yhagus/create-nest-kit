import type { Session } from './session.js';

export class SessionView {
  id!: string;
  userAgent!: string | null;
  ip!: string | null;
  createdAt!: Date;
  lastUsedAt!: Date;
  expiresAt!: Date;
  /** Whether the request was made with this session. */
  current!: boolean;
}

export function toSessionView(session: Session, currentSessionId?: string): SessionView {
  return {
    id: session.id,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: session.id === currentSessionId,
  };
}
