import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import type { Permission } from '../modules/permissions/permission.js';
import { PermissionPolicy } from './permission.policy.js';

// Every non-public route needs a signed-in user (the global authentication guard), and every
// handler without one of these decorators is refused (the global authorization guard).

/** Open to anyone, signed in or not. */
export { Public } from '@nestjs/authentication';

/** The signed-in user, as `AccessTokenProvider` loaded it. */
export { CurrentUser } from '@nestjs/authentication';

/** Any signed-in user. */
export const Authenticated = (): MethodDecorator & ClassDecorator => Can.Anyone();

/** A signed-in user holding every one of `permissions`. */
export const RequirePermissions = (
  ...permissions: [Permission, ...Permission[]]
): MethodDecorator & ClassDecorator => Can(PermissionPolicy, 'has', () => permissions);

/** The id of the session the request's access token belongs to: its `sid` claim. */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    // The authentication guard mirrors the verified claims on `request.session`.
    const { session } = context.switchToHttp().getRequest<{ session?: unknown }>();
    return sessionIdOf(session);
  },
);

function sessionIdOf(claims: unknown): string | undefined {
  if (typeof claims !== 'object' || claims === null || !('sid' in claims)) return undefined;
  return typeof claims.sid === 'string' ? claims.sid : undefined;
}
