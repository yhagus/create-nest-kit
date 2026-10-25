import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { discoverProviders } from '../../common/discover-providers.js';
import { AppConfig } from '../../config/app-config.js';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import type { Session } from './session.js';
import { SessionDenyList } from './session-deny-list.js';
import { isSessionRevocationHook, SessionRevocationHook } from './session-revocation-hook.js';
import { SessionsRepository } from './sessions.repository.js';

export interface NewDevice {
  userId: string;
  userAgent: string | null;
  ip: string | null;
}

/**
 * Device sessions, shared by every auth style. Revoking a session here also stops its access
 * tokens (through the deny-list) and its refresh tokens (through the revocation hooks).
 */
@Injectable()
@ExpiredDataPurger()
export class SessionsService implements OnModuleInit, ExpiredDataPurger {
  private revocationHooks: SessionRevocationHook[] = [];

  constructor(
    private readonly sessions: SessionsRepository,
    private readonly denyList: SessionDenyList,
    private readonly config: AppConfig,
    private readonly discovery: DiscoveryService,
  ) {}

  onModuleInit(): void {
    this.revocationHooks = discoverProviders(
      this.discovery,
      SessionRevocationHook,
      '@SessionRevocationHook()',
    ).map((wrapper) => {
      if (!isSessionRevocationHook(wrapper.instance)) {
        throw new Error(
          `${wrapper.name} is a @SessionRevocationHook() without onSessionsRevoked()`,
        );
      }
      return wrapper.instance;
    });
  }

  create(device: NewDevice): Promise<Session> {
    const now = new Date();
    const absoluteExpiresAt = after(now, this.config.get('SESSION_ABSOLUTE_TTL'));
    const slidingExpiresAt = after(now, this.config.get('REFRESH_TOKEN_TTL'));
    return this.sessions.create({
      ...device,
      createdAt: now,
      expiresAt: slidingExpiresAt < absoluteExpiresAt ? slidingExpiresAt : absoluteExpiresAt,
      absoluteExpiresAt,
    });
  }

  /** Neither revoked nor expired, newest first. */
  listActive(userId: string): Promise<Session[]> {
    return this.sessions.listActive(userId, new Date());
  }

  /** Records a refresh. Null when the session can no longer be used. */
  touch(sessionId: string): Promise<Session | null> {
    const now = new Date();
    return this.sessions.touch(sessionId, now, after(now, this.config.get('REFRESH_TOKEN_TTL')));
  }

  async revoke(sessionId: string): Promise<void> {
    if (await this.sessions.revoke(sessionId, new Date())) {
      await this.afterRevocation([sessionId]);
    }
  }

  /** Revokes one of the user's sessions; 404 when it isn't theirs or is already revoked. */
  async revokeForUser(userId: string, sessionId: string): Promise<void> {
    if (!(await this.sessions.revoke(sessionId, new Date(), { userId }))) {
      throw new NotFoundException('Session not found');
    }
    await this.afterRevocation([sessionId]);
  }

  async revokeAllForUser(userId: string, { except }: { except?: string } = {}): Promise<void> {
    const revokedIds = await this.sessions.revokeAllForUser(userId, new Date(), {
      exceptId: except,
    });
    await this.afterRevocation(revokedIds);
  }

  /** Whether the session was revoked recently enough that its access tokens may still be unexpired. */
  isRevoked(sessionId: string): Promise<boolean> {
    return this.denyList.includes(sessionId);
  }

  /** Deletes sessions that expired at or before `now`. Returns how many. */
  purgeExpired(now: Date): Promise<number> {
    return this.sessions.deleteExpired(now);
  }

  private async afterRevocation(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    await this.denyList.add(sessionIds);
    for (const hook of this.revocationHooks) {
      await hook.onSessionsRevoked(sessionIds);
    }
  }
}

function after(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}
