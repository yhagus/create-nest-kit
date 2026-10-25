import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { permissionsOf } from '../modules/users/user.js';
import { accessRuleOf } from './access-rule.js';
import type { AuthenticatedRequest } from './decorators.js';

/**
 * Global, after JwtAuthGuard. Deny by default: a handler without an access decorator is
 * refused, and `@RequirePermissions()` needs every listed permission among the union of the
 * user's roles. The response never says which permission was missing.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = accessRuleOf(this.reflector, context);
    switch (rule.kind) {
      case 'public':
      case 'authenticated':
        return true;
      case 'permissions': {
        const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const granted = user ? permissionsOf(user) : [];
        if (rule.permissions.every((permission) => granted.includes(permission))) return true;
        throw new ForbiddenException();
      }
      case 'none':
        throw new ForbiddenException();
    }
  }
}
