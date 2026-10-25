import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { VerificationPurpose } from '../../auth/verification-tokens.repository.js';
import { id, timestamptz } from './columns.js';
import { users } from './users.js';

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull().$type<VerificationPurpose>(),
    tokenHash: text().notNull().unique('verification_tokens_token_hash_unique'),
    expiresAt: timestamptz().notNull(),
    createdAt: timestamptz().notNull(),
  },
  // By user and purpose to replace a user's tokens; by expiry for the daily purge.
  (table) => [index().on(table.userId, table.purpose), index().on(table.expiresAt)],
);
