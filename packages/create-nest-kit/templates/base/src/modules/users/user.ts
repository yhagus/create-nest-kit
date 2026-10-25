import { ALL_PERMISSIONS, type Permission } from '../permissions/permission.js';
import type { Role } from '../roles/role.js';

/** A role as seen from a user: enough to show it and to authorize. */
export type UserRole = Pick<Role, 'id' | 'name' | 'permissions'>;

export interface User {
  id: string;
  /** Always normalized; see `normalizeEmail`. */
  email: string;
  passwordHash: string;
  name: string;
  emailVerifiedAt: Date | null;
  /** Ordered by name. */
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

/** The longest email the API accepts: the limit of an address in an SMTP command. */
export const EMAIL_MAX_LENGTH = 254;
export const USER_NAME_MAX_LENGTH = 100;

/** The union of the user's roles' permissions, in declaration order. */
export function permissionsOf(user: Pick<User, 'roles'>): Permission[] {
  return ALL_PERMISSIONS.filter((permission) =>
    user.roles.some((role) => role.permissions.includes(permission)),
  );
}
