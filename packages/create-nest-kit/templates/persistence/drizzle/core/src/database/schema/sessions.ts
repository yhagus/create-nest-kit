import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamptz } from './columns.js';
import { users } from './users.js';

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text(),
    ip: text(),
    createdAt: timestamptz().notNull(),
    lastUsedAt: timestamptz().notNull(),
    expiresAt: timestamptz().notNull(),
    absoluteExpiresAt: timestamptz().notNull(),
    revokedAt: timestamptz(),
  },
  // By user for listing and revoking; by expiry for the daily purge.
  (table) => [index().on(table.userId), index().on(table.expiresAt)],
);
