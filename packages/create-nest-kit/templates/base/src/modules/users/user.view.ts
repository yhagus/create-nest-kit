import type { Permission } from '../permissions/permission.js';
import { permissionsOf, type User } from './user.js';

export class UserRoleView {
  id!: string;
  name!: string;
}

export class UserView {
  id!: string;
  email!: string;
  name!: string;
  emailVerified!: boolean;
  roles!: UserRoleView[];
  /** The union of the roles' permissions. */
  permissions!: Permission[];
  createdAt!: Date;
  updatedAt!: Date;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    roles: user.roles.map(({ id, name }) => ({ id, name })),
    permissions: permissionsOf(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
