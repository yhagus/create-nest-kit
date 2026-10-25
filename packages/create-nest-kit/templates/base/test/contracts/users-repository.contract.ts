import { beforeEach, describe, expect, it } from 'vitest';
import { Permission } from '../../src/modules/permissions/permission.js';
import type { RolesRepository } from '../../src/modules/roles/roles.repository.js';
import type { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import {
  UnknownRoleIdsException,
  UserEmailTakenException,
  type UsersRepository,
} from '../../src/modules/users/users.repository.js';
import {
  aRole,
  aSession,
  aUser,
  NOW,
  type RepositoriesFactory,
  UNKNOWN_ID,
} from './repositories.js';

/** The behaviour every `UsersRepository` implementation must have. */
export function describeUsersRepositoryContract(createRepositories: RepositoriesFactory): void {
  describe('UsersRepository contract', () => {
    let users: UsersRepository;
    let roles: RolesRepository;
    let sessions: SessionsRepository;

    beforeEach(async () => {
      ({ users, roles, sessions } = await createRepositories());
    });

    it('creates a user with roles and finds it by id and by email', async () => {
      const support = await roles.create(
        aRole({ name: 'support', permissions: [Permission.UsersRead] }),
      );
      const auditor = await roles.create(
        aRole({ name: 'auditor', permissions: [Permission.RolesRead] }),
      );
      const verifiedAt = new Date('2026-01-02T03:04:05.000Z');

      const created = await users.create(
        aUser({ emailVerifiedAt: verifiedAt, roleIds: [support.id, auditor.id] }),
      );

      expect(created).toEqual({
        id: expect.any(String),
        email: 'ada@example.com',
        passwordHash: 'hash',
        name: 'Ada Lovelace',
        emailVerifiedAt: verifiedAt,
        roles: [
          { id: auditor.id, name: 'auditor', permissions: [Permission.RolesRead] },
          { id: support.id, name: 'support', permissions: [Permission.UsersRead] },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await users.findById(created.id)).toEqual(created);
      expect(await users.findByEmail('ada@example.com')).toEqual(created);
    });

    it('returns null for an unknown user', async () => {
      expect(await users.findById(UNKNOWN_ID)).toBeNull();
      expect(await users.findByEmail('nobody@example.com')).toBeNull();
    });

    it('rejects a second user with the same email', async () => {
      await users.create(aUser({ email: 'ada@example.com' }));

      await expect(users.create(aUser({ email: 'ada@example.com' }))).rejects.toThrow(
        UserEmailTakenException,
      );
    });

    it('lets only one of two concurrent creates with the same email succeed', async () => {
      const results = await Promise.allSettled([
        users.create(aUser({ email: 'ada@example.com' })),
        users.create(aUser({ email: 'ada@example.com' })),
      ]);

      expect(results.map((result) => result.status).toSorted()).toEqual(['fulfilled', 'rejected']);
    });

    it('rejects changing the email to one in use', async () => {
      await users.create(aUser({ email: 'ada@example.com' }));
      const grace = await users.create(aUser({ email: 'grace@example.com' }));

      await expect(users.update(grace.id, { email: 'ada@example.com' })).rejects.toThrow(
        UserEmailTakenException,
      );
    });

    it('updates only the given fields, replacing the roles', async () => {
      const support = await roles.create(aRole({ name: 'support' }));
      const auditor = await roles.create(aRole({ name: 'auditor' }));
      const user = await users.create(
        aUser({ emailVerifiedAt: new Date('2026-01-02T00:00:00.000Z'), roleIds: [support.id] }),
      );

      const updated = await users.update(user.id, {
        name: 'Ada King',
        emailVerifiedAt: null,
        roleIds: [auditor.id],
      });

      expect(updated).toMatchObject({
        email: 'ada@example.com',
        passwordHash: 'hash',
        name: 'Ada King',
        emailVerifiedAt: null,
        roles: [{ id: auditor.id, name: 'auditor' }],
      });
      expect(await users.findById(user.id)).toEqual(updated);
    });

    it('rejects creating a user with a role that does not exist, storing nothing', async () => {
      await expect(users.create(aUser({ roleIds: [UNKNOWN_ID] }))).rejects.toThrow(
        UnknownRoleIdsException,
      );

      expect(await users.findByEmail('ada@example.com')).toBeNull();
    });

    it('rejects giving a user a role that does not exist, keeping their roles', async () => {
      const support = await roles.create(aRole({ name: 'support' }));
      const user = await users.create(aUser({ roleIds: [support.id] }));

      await expect(users.update(user.id, { roleIds: [UNKNOWN_ID] })).rejects.toThrow(
        UnknownRoleIdsException,
      );

      expect((await users.findById(user.id))?.roles.map((role) => role.id)).toEqual([support.id]);
    });

    it('returns null when updating an unknown user', async () => {
      expect(await users.update(UNKNOWN_ID, { name: 'Nobody' })).toBeNull();
    });

    it('lists one page of users by email, with the total', async () => {
      for (const email of [
        'carol@example.com',
        'alice@example.com',
        'dave@example.com',
        'bob@example.com',
      ]) {
        await users.create(aUser({ email }));
      }

      const page = await users.list({ page: 2, limit: 2 });

      expect(page.items.map((user) => user.email)).toEqual([
        'carol@example.com',
        'dave@example.com',
      ]);
      expect(page.total).toBe(4);
    });

    it('searches the email and the name, ignoring case', async () => {
      await users.create(aUser({ email: 'ada@example.com', name: 'Ada Lovelace' }));
      await users.create(aUser({ email: 'grace@navy.example', name: 'Grace Hopper' }));
      await users.create(aUser({ email: 'alan@example.com', name: 'Alan Turing' }));

      const byName = await users.list({ page: 1, limit: 10, search: 'HOPP' });
      const byEmail = await users.list({ page: 1, limit: 10, search: 'Example.COM' });

      expect(byName.items.map((user) => user.name)).toEqual(['Grace Hopper']);
      expect(byName.total).toBe(1);
      expect(byEmail.items.map((user) => user.email)).toEqual([
        'ada@example.com',
        'alan@example.com',
      ]);
    });

    it('treats % and _ in a search as plain characters', async () => {
      await users.create(aUser({ email: 'ada@example.com', name: 'Ada' }));
      await users.create(aUser({ email: 'under_score@example.com', name: '100% Grace' }));

      const percent = await users.list({ page: 1, limit: 10, search: '%' });
      const underscore = await users.list({ page: 1, limit: 10, search: '_' });

      expect(percent.items.map((user) => user.name)).toEqual(['100% Grace']);
      expect(underscore.items.map((user) => user.name)).toEqual(['100% Grace']);
    });

    it('deletes a user together with their sessions', async () => {
      const user = await users.create(aUser());
      const session = await sessions.create(aSession(user.id));

      expect(await users.delete(user.id)).toBe(true);

      expect(await users.findById(user.id)).toBeNull();
      expect(await sessions.findById(session.id)).toBeNull();
      expect(await sessions.listActive(user.id, NOW)).toEqual([]);
      expect(await users.delete(user.id)).toBe(false);
    });
  });
}
