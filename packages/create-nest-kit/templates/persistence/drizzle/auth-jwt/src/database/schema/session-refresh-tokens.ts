import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions.js';

/** The hash of each session's current refresh token; rotation compares and sets `token_hash`. */
export const sessionRefreshTokens = pgTable('session_refresh_tokens', {
  sessionId: uuid()
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull(),
});
