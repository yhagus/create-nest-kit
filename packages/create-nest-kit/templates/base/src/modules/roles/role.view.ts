import type { Permission } from '../permissions/permission.js';
import type { Role } from './role.js';

export class RoleView {
  id!: string;
  name!: string;
  description!: string;
  permissions!: Permission[];
  isSystem!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toRoleView(role: Role): RoleView {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    isSystem: role.isSystem,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}
