import { type CookieSerializeOptions, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DEFAULT_API_VERSION, GLOBAL_PREFIX } from '../bootstrap/configure-app.js';
import { AppConfig } from '../config/app-config.js';
import type { IssuedTokens } from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';

/** Sent only to the auth routes, which are the only ones that read it. */
const REFRESH_COOKIE_PATH = `/${GLOBAL_PREFIX}/v${DEFAULT_API_VERSION}/auth`;
const MILLISECONDS_PER_SECOND = 1000;
/** Local and test servers run on plain http, where browsers drop `Secure` cookies. */
const INSECURE_ENVIRONMENTS = new Set(['development', 'test']);

/** Writes the refresh token cookie through the HTTP adapter, so it works on every platform. */
@Injectable()
export class RefreshCookie {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly config: AppConfig,
  ) {}

  /** `response` is the platform's native response object (`@Res({ passthrough: true })`). */
  set(response: unknown, { tokens, refreshTokenExpiresAt }: IssuedTokens): void {
    const remainingMs = refreshTokenExpiresAt.getTime() - Date.now();
    this.adapterHost.httpAdapter.setCookie(response, REFRESH_COOKIE, tokens.refreshToken, {
      ...this.attributes(),
      // Max-Age is in seconds. Rounded, as a few milliseconds pass between issuing and writing it.
      maxAge: Math.max(0, Math.round(remainingMs / MILLISECONDS_PER_SECOND)),
    });
  }

  clear(response: unknown): void {
    this.adapterHost.httpAdapter.clearCookie(response, REFRESH_COOKIE, this.attributes());
  }

  private attributes(): CookieSerializeOptions {
    return {
      httpOnly: true,
      secure: !INSECURE_ENVIRONMENTS.has(this.config.get('NODE_ENV')),
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    };
  }
}
