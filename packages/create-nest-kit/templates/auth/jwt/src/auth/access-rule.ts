import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Permission } from '../modules/permissions/permission.js';
import { IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators.js';

/** Who may call a handler, from its `@Public()`, `@Authenticated()` or `@RequirePermissions()`. */
export type AccessRule =
  | { kind: 'public' }
  | { kind: 'authenticated' }
  | { kind: 'permissions'; permissions: Permission[] }
  /** No access decorator: refused, so a forgotten decorator never opens a route. */
  | { kind: 'none' };

export function accessRuleOf(reflector: Reflector, context: ExecutionContext): AccessRule {
  const targets = [context.getHandler(), context.getClass()];
  if (reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) {
    return { kind: 'public' };
  }
  const permissions = reflector.getAllAndOverride<Permission[] | undefined>(
    PERMISSIONS_KEY,
    targets,
  );
  if (permissions) return { kind: 'permissions', permissions };
  if (reflector.getAllAndOverride<boolean | undefined>(IS_AUTHENTICATED_KEY, targets)) {
    return { kind: 'authenticated' };
  }
  return { kind: 'none' };
}
