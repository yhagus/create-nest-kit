/**
 * Everything a role can grant. Guard a handler with `@RequirePermissions(Permission.UsersRead)`.
 * Adding a value here makes it grantable; the seed gives it to `admin` on its next run.
 */
export enum Permission {
  UsersRead = 'users:read',
  UsersCreate = 'users:create',
  UsersUpdate = 'users:update',
  UsersDelete = 'users:delete',
  RolesRead = 'roles:read',
  RolesCreate = 'roles:create',
  RolesUpdate = 'roles:update',
  RolesDelete = 'roles:delete',
  SessionsRead = 'sessions:read',
  SessionsRevoke = 'sessions:revoke',
}

/** Every permission, in declaration order. */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);
