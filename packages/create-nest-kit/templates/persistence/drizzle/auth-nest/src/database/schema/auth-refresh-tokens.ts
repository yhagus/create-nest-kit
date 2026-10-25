import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns.js';
import { sessions } from './sessions.js';

/**
 * `@nestjs/authentication`'s refresh tokens (`RefreshTokenRecord`), stored by the SHA-256 of
 * the token. A family counts as revoked when any of its tokens is, so a revocation also covers
 * tokens a racing refresh saves after it. `session_id` is the device session of the sign-in
 * (`claims.sid`); its tokens go when the session row does.
 */
export const authRefreshTokens = pgTable(
  'auth_refresh_tokens',
  {
    id: text().primaryKey(),
    familyId: text().notNull(),
    // Text, not a foreign key: the package's user ids are opaque strings.
    userId: text().notNull(),
    sessionId: uuid().references(() => sessions.id, { onDelete: 'cascade' }),
    createdAt: timestamptz().notNull(),
    expiresAt: timestamptz().notNull(),
    familyExpiresAt: timestamptz().notNull(),
    usedAt: timestamptz(),
    revoked: boolean().notNull().default(false),
    claims: jsonb().$type<Record<string, unknown>>(),
  },
  (table) => [
    index().on(table.familyId),
    index().on(table.userId),
    index().on(table.sessionId),
    index().on(table.familyExpiresAt),
  ],
);
