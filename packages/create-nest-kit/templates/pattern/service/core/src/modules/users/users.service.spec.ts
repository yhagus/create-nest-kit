import { NotFoundException } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAppConfig } from '../../../test/fakes/fake-app-config.js';
import { FakePasswordHasher } from '../../../test/fakes/fake-password-hasher.js';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../../../test/fakes/in-memory-repositories.js';
import { InMemorySessionDenyList } from '../../../test/fakes/in-memory-session-deny-list.js';
import { PasswordHasher } from '../../auth/password-hasher.js';
import { AppConfig } from '../../config/app-config.js';
import { Permission } from '../permissions/permission.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { SessionDenyList } from '../sessions/session-deny-list.js';
import { SessionsRepository } from '../sessions/sessions.repository.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const DAY_MS = 86_400_000;

describe('UsersService', () => {
  let usersService: UsersService;
  let sessionsService: SessionsService;
  let repositories: InMemoryRepositories;

  const aUserInput = { email: 'ada@example.com', password: 'correct horse', name: 'Ada Lovelace' };

  const signIn = (userId: string) => sessionsService.create({ userId, userAgent: null, ip: null });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    repositories = createInMemoryRepositories();
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        UsersService,
        SessionsService,
        { provide: UsersRepository, useValue: repositories.users },
        { provide: RolesRepository, useValue: repositories.roles },
        { provide: SessionsRepository, useValue: repositories.sessions },
        { provide: PasswordHasher, useClass: FakePasswordHasher },
        { provide: SessionDenyList, useClass: InMemorySessionDenyList },
        {
          provide: AppConfig,
          useValue: fakeAppConfig({ REFRESH_TOKEN_TTL: DAY_MS, SESSION_ABSOLUTE_TTL: 3 * DAY_MS }),
        },
      ],
    }).compile();
    await moduleRef.init();
    usersService = moduleRef.get(UsersService);
    sessionsService = moduleRef.get(SessionsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a user with a hashed password, a normalized email and the given roles', async () => {
    const support = await repositories.roles.create({
      name: 'support',
      description: '',
      permissions: [Permission.UsersRead],
      isSystem: false,
    });

    const user = await usersService.createUser({
      ...aUserInput,
      email: '  Ada@Example.COM ',
      roleIds: [support.id],
      emailVerified: true,
    });

    expect(user).toMatchObject({
      email: 'ada@example.com',
      passwordHash: 'hashed:correct horse',
      emailVerifiedAt: NOW,
      roles: [{ id: support.id, name: 'support' }],
    });
  });

  it('finds a user by email in any case', async () => {
    const created = await usersService.createUser(aUserInput);

    expect((await usersService.findByEmail(' ADA@example.com'))?.id).toBe(created.id);
  });

  it('signs the user out everywhere when an admin changes their password', async () => {
    const user = await usersService.createUser(aUserInput);
    const session = await signIn(user.id);

    const updated = await usersService.updateUser(user.id, { password: 'new password' });

    expect(updated.passwordHash).toBe('hashed:new password');
    expect(await sessionsService.isRevoked(session.id)).toBe(true);
  });

  it('keeps only the current session when a user changes their own password', async () => {
    const user = await usersService.createUser(aUserInput);
    const current = await signIn(user.id);
    const other = await signIn(user.id);

    await usersService.changePassword(user.id, 'new password', current.id);

    expect((await usersService.getUser(user.id)).passwordHash).toBe('hashed:new password');
    expect(await sessionsService.isRevoked(current.id)).toBe(false);
    expect(await sessionsService.isRevoked(other.id)).toBe(true);
  });

  it('keeps the user signed in when other fields change', async () => {
    const user = await usersService.createUser(aUserInput);
    const session = await signIn(user.id);

    await usersService.updateUser(user.id, { name: 'Ada King', emailVerified: false });

    expect(await sessionsService.isRevoked(session.id)).toBe(false);
  });

  it('revokes the sessions of a deleted user', async () => {
    const admin = await usersService.createUser({ ...aUserInput, email: 'admin@example.com' });
    const user = await usersService.createUser(aUserInput);
    const session = await signIn(user.id);

    await usersService.deleteUser(user.id, admin.id);

    expect(await sessionsService.isRevoked(session.id)).toBe(true);
    await expect(usersService.getUser(user.id)).rejects.toThrow(NotFoundException);
  });
});
