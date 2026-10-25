import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '../modules/permissions/permission.js';
import type { User } from '../modules/users/user.js';

export const IS_PUBLIC_KEY = 'auth:public';
export const IS_AUTHENTICATED_KEY = 'auth:authenticated';
export const PERMISSIONS_KEY = 'auth:permissions';

/** Open to anyone, signed in or not. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Any signed-in user. */
export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_AUTHENTICATED_KEY, true);

/** A signed-in user holding every one of `permissions`. */
export const RequirePermissions = (
  ...permissions: [Permission, ...Permission[]]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

/** What `JwtAuthGuard` puts on the request of a route that needs a signed-in user. */
export interface AuthenticatedRequest {
  user?: User;
  sessionId?: string;
}

function requestOf(context: ExecutionContext): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

/** The signed-in user the auth guard put on the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => requestOf(context).user,
);

/** The id of the session the request's access token belongs to. */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => requestOf(context).sessionId,
);
