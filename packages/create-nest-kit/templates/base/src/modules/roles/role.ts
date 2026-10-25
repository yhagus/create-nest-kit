import type { Permission } from '../permissions/permission.js';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Created by the seed. System roles can't be renamed or deleted. */
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Lower-case letters, digits and dashes, starting with a letter; 2 to 49 characters. */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;
export const ROLE_DESCRIPTION_MAX_LENGTH = 500;

/** The system roles the seed creates. */
export const SystemRoleName = {
  /** Always holds every permission. */
  Admin: 'admin',
  /** Given to every self-registered user; no permissions by default. */
  User: 'user',
} as const;

export function isAdminRole(role: Role): boolean {
  return role.isSystem && role.name === SystemRoleName.Admin;
}
