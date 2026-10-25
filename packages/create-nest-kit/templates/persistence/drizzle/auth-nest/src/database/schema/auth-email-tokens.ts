import { index, pgTable, text } from 'drizzle-orm/pg-core';
import type { EmailTokenPurpose } from '@nestjs/authentication';
import { timestamptz } from './columns.js';

/** `@nestjs/authentication`'s password-reset and email-verification links, by the SHA-256 of the token. */
export const authEmailTokens = pgTable(
  'auth_email_tokens',
  {
    id: text().primaryKey(),
    purpose: text().notNull().$type<EmailTokenPurpose>(),
    userId: text().notNull(),
    email: text().notNull(),
    fingerprint: text(),
    createdAt: timestamptz().notNull(),
    expiresAt: timestamptz().notNull(),
  },
  (table) => [index().on(table.userId, table.purpose), index().on(table.expiresAt)],
);
