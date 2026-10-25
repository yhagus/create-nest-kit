import { ALL_PERMISSIONS, type Permission } from '../modules/permissions/permission.js';

function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.some((permission) => permission === value);
}

/**
 * The stored permission values as `Permission`s. Roles are written only through validated
 * input, so an unknown value means the column was edited by hand or a permission was removed
 * from the enum without migrating the rows.
 */
export function toPermissions(values: readonly string[]): Permission[] {
  return values.map((value) => {
    if (!isPermission(value)) throw new Error(`Unknown permission stored on a role: ${value}`);
    return value;
  });
}
