import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { SessionDenyList } from './session-deny-list.js';
import { isSessionRevocationHook, SessionRevocationHook } from './session-revocation-hook.js';

/**
 * Makes revoked sessions stop working at once: the deny-list refuses their unexpired access
 * tokens and the `@SessionRevocationHook()` providers drop their refresh tokens. Every revoke
 * command runs it, awaited, right after the repository marks the sessions revoked.
 */
@Injectable()
export class RevokedSessionsEnforcer implements OnModuleInit {
  private revocationHooks: SessionRevocationHook[] = [];

  constructor(
    private readonly denyList: SessionDenyList,
    private readonly discovery: DiscoveryService,
  ) {}

  onModuleInit(): void {
    this.revocationHooks = this.discovery
      .getProviders({ metadataKey: SessionRevocationHook.KEY })
      .map((wrapper) => {
        if (!isSessionRevocationHook(wrapper.instance)) {
          throw new Error(
            `${wrapper.name} is a @SessionRevocationHook() without onSessionsRevoked()`,
          );
        }
        return wrapper.instance;
      });
  }

  async enforce(revokedSessionIds: string[]): Promise<void> {
    if (revokedSessionIds.length === 0) return;
    await this.denyList.add(revokedSessionIds);
    for (const hook of this.revocationHooks) {
      await hook.onSessionsRevoked(revokedSessionIds);
    }
  }
}
