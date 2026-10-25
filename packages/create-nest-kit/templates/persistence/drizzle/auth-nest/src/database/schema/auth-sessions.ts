import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type { MfaState } from '@nestjs/authentication';
import { timestamptz } from './columns.js';

/**
 * `@nestjs/authentication`'s cookie sessions (`SessionRecord`). This app signs in with tokens
 * and keeps device sessions in `sessions`, so the table stays empty, but password reset
 * needs a session store to end them in.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    createdAt: timestamptz().notNull(),
    expiresAt: timestamptz().notNull(),
    lastActiveAt: timestamptz().notNull(),
    mfa: text().$type<MfaState>(),
    metadata: jsonb().$type<Record<string, unknown>>(),
  },
  (table) => [index().on(table.userId), index().on(table.expiresAt)],
);
