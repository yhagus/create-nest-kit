import { boolean, pgTable, text } from 'drizzle-orm/pg-core';
import type { Permission } from '../../modules/permissions/permission.js';
import { id, timestamptz } from './columns.js';

export const ROLES_NAME_UNIQUE = 'roles_name_unique';

export const roles = pgTable('roles', {
  id: id(),
  name: text().notNull().unique(ROLES_NAME_UNIQUE),
  description: text().notNull(),
  permissions: text().array().notNull().$type<Permission[]>(),
  isSystem: boolean().notNull().default(false),
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
