import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aUser } from '../../../test/contracts/repositories.js';
import { fakeAppConfig } from '../../../test/fakes/fake-app-config.js';
import { createInMemoryRepositories } from '../../../test/fakes/in-memory-repositories.js';
import { InMemorySessionDenyList } from '../../../test/fakes/in-memory-session-deny-list.js';
import { AppConfig } from '../../config/app-config.js';
import { SessionDenyList } from './session-deny-list.js';
import { SessionRevocationHook } from './session-revocation-hook.js';
import { SessionsRepository } from './sessions.repository.js';
import { SessionsService } from './sessions.service.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const REFRESH_TOKEN_TTL = 24 * HOUR_MS;
const SESSION_ABSOLUTE_TTL = 72 * HOUR_MS;

@Injectable()
@SessionRevocationHook()
class RecordingRevocationHook implements SessionRevocationHook {
  readonly revokedBatches: string[][] = [];

  async onSessionsRevoked(sessionIds: string[]): Promise<void> {
    this.revokedBatches.push(sessionIds);
  }
}

describe('SessionsService', () => {
  let sessionsService: SessionsService;
  let hook: RecordingRevocationHook;
  let userId: string;
  let otherUserId: string;

  const signIn = (forUserId: string) =>
    sessionsService.create({ userId: forUserId, userAgent: 'Mozilla/5.0', ip: '203.0.113.7' });

  const activeSessionIds = async (forUserId: string) =>
    (await sessionsService.listActive(forUserId)).map((session) => session.id);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const repositories = createInMemoryRepositories();
    userId = (await repositories.users.create(aUser({ email: 'ada@example.com' }))).id;
    otherUserId = (await repositories.users.create(aUser({ email: 'grace@example.com' }))).id;

    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        SessionsService,
        RecordingRevocationHook,
        { provide: SessionsRepository, useValue: repositories.sessions },
        { provide: SessionDenyList, useClass: InMemorySessionDenyList },
        {
          provide: AppConfig,
          useValue: fakeAppConfig({ REFRESH_TOKEN_TTL, SESSION_ABSOLUTE_TTL }),
        },
      ],
    }).compile();
    await moduleRef.init();
    sessionsService = moduleRef.get(SessionsService);
    hook = moduleRef.get(RecordingRevocationHook);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a session that expires after the refresh token lifetime', async () => {
    const session = await signIn(userId);

    expect(session).toMatchObject({
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + REFRESH_TOKEN_TTL),
      absoluteExpiresAt: new Date(NOW.getTime() + SESSION_ABSOLUTE_TTL),
    });
    expect(await activeSessionIds(userId)).toEqual([session.id]);
  });

  it('slides the expiry from the time a session is used', async () => {
    const session = await signIn(userId);
    const usedAt = new Date(NOW.getTime() + 10 * HOUR_MS);
    vi.setSystemTime(usedAt);

    const touched = await sessionsService.touch(session.id);

    expect(touched).toMatchObject({
      lastUsedAt: usedAt,
      expiresAt: new Date(usedAt.getTime() + REFRESH_TOKEN_TTL),
    });
  });

  it('deny-lists a revoked session and tells the revocation hooks', async () => {
    const session = await signIn(userId);

    await sessionsService.revoke(session.id);

    expect(await sessionsService.isRevoked(session.id)).toBe(true);
    expect(hook.revokedBatches).toEqual([[session.id]]);
    expect(await activeSessionIds(userId)).toEqual([]);
  });

  it('does not tell the hooks again about a session that was already revoked', async () => {
    const session = await signIn(userId);
    await sessionsService.revoke(session.id);

    await sessionsService.revoke(session.id);

    expect(hook.revokedBatches).toHaveLength(1);
  });

  it('answers 404 when a user revokes a session that is not theirs', async () => {
    const session = await signIn(otherUserId);

    await expect(sessionsService.revokeForUser(userId, session.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(await sessionsService.isRevoked(session.id)).toBe(false);
    expect(await activeSessionIds(otherUserId)).toEqual([session.id]);
  });

  it('revokes all of a user’s other sessions in one batch', async () => {
    const current = await signIn(userId);
    const laptop = await signIn(userId);
    const phone = await signIn(userId);
    const otherUsers = await signIn(otherUserId);

    await sessionsService.revokeAllForUser(userId, { except: current.id });

    expect(await activeSessionIds(userId)).toEqual([current.id]);
    expect(await sessionsService.isRevoked(laptop.id)).toBe(true);
    expect(await sessionsService.isRevoked(phone.id)).toBe(true);
    expect(hook.revokedBatches.map((batch) => batch.toSorted())).toEqual([
      [laptop.id, phone.id].toSorted(),
    ]);
    expect(await activeSessionIds(otherUserId)).toEqual([otherUsers.id]);
  });
});
