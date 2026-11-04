import { ALL_PERMISSIONS, type Permission } from '../permissions/permission.js';

/** Each permission once, in declaration order. */
export function distinctPermissions(permissions: readonly Permission[]): Permission[] {
  return ALL_PERMISSIONS.filter((permission) => permissions.includes(permission));
}
