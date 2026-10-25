import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingHttpHeaders } from 'node:http';
import { ErrorCode } from '../common/error-code.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { AccessTokens } from './access-tokens.js';
import { accessRuleOf } from './access-rule.js';
import type { AuthenticatedRequest } from './decorators.js';

const BEARER_PREFIX = 'Bearer ';

type HttpRequest = AuthenticatedRequest & { headers: IncomingHttpHeaders };

/**
 * Global. On routes that need a signed-in user, checks the Bearer access token and that its
 * session isn't revoked, then puts the user and session id on the request. Authorization is
 * PermissionsGuard's job, which runs next.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokens,
    private readonly sessions: SessionsService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = accessRuleOf(this.reflector, context);
    // Every non-public handler needs a signed-in user, including one without an access
    // decorator, which PermissionsGuard then refuses with 403.
    if (rule.kind === 'public') return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const token = bearerTokenOf(request.headers.authorization);
    const claims = token === null ? null : await this.accessTokens.verify(token);
    // The deny-list makes a revoked session's unexpired access tokens stop working at once.
    if (claims === null || (await this.sessions.isRevoked(claims.sid))) throw unauthenticated();

    const user = await this.users.findById(claims.sub);
    if (!user) throw unauthenticated();
    request.user = user;
    request.sessionId = claims.sid;
    return true;
  }
}

function bearerTokenOf(authorization: string | undefined): string | null {
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length).trim() || null;
}

function unauthenticated(): UnauthorizedException {
  return new UnauthorizedException('Authentication required', {
    errorCode: ErrorCode.Unauthenticated,
  });
}
