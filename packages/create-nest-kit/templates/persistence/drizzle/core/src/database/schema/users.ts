import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamptz } from './columns.js';
import { roles } from './roles.js';

export const USERS_EMAIL_UNIQUE = 'users_email_unique';
/** The name drizzle-kit gives the foreign key from user_roles.role_id to roles.id. */
export const USER_ROLES_ROLE_FK = 'user_roles_role_id_roles_id_fk';

export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(USERS_EMAIL_UNIQUE),
  passwordHash: text().notNull(),
  name: text().notNull(),
  emailVerifiedAt: timestamptz(),
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  // The primary key serves lookups by user; deleting a role looks them up by role.
  (table) => [primaryKey({ columns: [table.userId, table.roleId] }), index().on(table.roleId)],
);
