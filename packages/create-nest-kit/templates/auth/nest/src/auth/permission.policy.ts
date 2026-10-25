import { Policy } from '@nestjs/authorization';
import type { Permission } from '../modules/permissions/permission.js';
import { permissionsOf, type User } from '../modules/users/user.js';

/** Behind `@RequirePermissions()`: the user holds every listed permission among the union of their roles'. */
@Policy()
export class PermissionPolicy {
  has(user: User | null, first: Permission, ...rest: Permission[]): boolean {
    if (!user) return false;
    const granted = new Set(permissionsOf(user));
    return [first, ...rest].every((permission) => granted.has(permission));
  }
}
