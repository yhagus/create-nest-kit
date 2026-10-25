/** One signed-in device. Refreshing slides `expiresAt`, but never past `absoluteExpiresAt`. */
export interface Session {
  id: string;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

/** Neither revoked nor expired at `now`. */
export function isActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}
