import { beforeEach, describe, expect, it } from 'vitest';
import { Permission } from '../../src/modules/permissions/permission.js';
import {
  RoleNameTakenException,
  type RolesRepository,
} from '../../src/modules/roles/roles.repository.js';
import type { UsersRepository } from '../../src/modules/users/users.repository.js';
import { aRole, aUser, type RepositoriesFactory, UNKNOWN_ID } from './repositories.js';

/** The behaviour every `RolesRepository` implementation must have. */
export function describeRolesRepositoryContract(createRepositories: RepositoriesFactory): void {
  describe('RolesRepository contract', () => {
    let roles: RolesRepository;
    let users: UsersRepository;

    beforeEach(async () => {
      ({ roles, users } = await createRepositories());
    });

    it('creates a role and finds it by id and by name', async () => {
      const created = await roles.create(
        aRole({ name: 'auditor', permissions: [Permission.UsersRead, Permission.RolesRead] }),
      );

      expect(created).toEqual({
        id: expect.any(String),
        name: 'auditor',
        description: 'Edits content',
        permissions: [Permission.UsersRead, Permission.RolesRead],
        isSystem: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await roles.findById(created.id)).toEqual(created);
      expect(await roles.findByName('auditor')).toEqual(created);
    });

    it('returns null for an unknown role', async () => {
      expect(await roles.findById(UNKNOWN_ID)).toBeNull();
      expect(await roles.findByName('ghost')).toBeNull();
    });

    it('lists every role by name', async () => {
      await roles.create(aRole({ name: 'support' }));
      await roles.create(aRole({ name: 'admin' }));
      await roles.create(aRole({ name: 'editor' }));

      const names = (await roles.findAll()).map((role) => role.name);

      expect(names).toEqual(['admin', 'editor', 'support']);
    });

    it('finds the roles among a list of ids, skipping unknown ones', async () => {
      const editor = await roles.create(aRole({ name: 'editor' }));
      await roles.create(aRole({ name: 'support' }));

      const found = await roles.findByIds([editor.id, UNKNOWN_ID]);

      expect(found.map((role) => role.name)).toEqual(['editor']);
    });

    it('rejects a second role with the same name', async () => {
      await roles.create(aRole({ name: 'editor' }));

      await expect(roles.create(aRole({ name: 'editor' }))).rejects.toThrow(RoleNameTakenException);
    });

    it('lets only one of two concurrent creates with the same name succeed', async () => {
      const results = await Promise.allSettled([
        roles.create(aRole({ name: 'editor' })),
        roles.create(aRole({ name: 'editor' })),
      ]);

      expect(results.map((result) => result.status).toSorted()).toEqual(['fulfilled', 'rejected']);
    });

    it('updates only the given fields', async () => {
      const editor = await roles.create(aRole({ name: 'editor' }));

      const updated = await roles.update(editor.id, { description: 'Writes articles' });

      expect(updated).toMatchObject({
        name: 'editor',
        description: 'Writes articles',
        permissions: [Permission.UsersRead],
      });
      expect(await roles.findById(editor.id)).toEqual(updated);
    });

    it('rejects renaming a role to a name in use', async () => {
      await roles.create(aRole({ name: 'editor' }));
      const support = await roles.create(aRole({ name: 'support' }));

      await expect(roles.update(support.id, { name: 'editor' })).rejects.toThrow(
        RoleNameTakenException,
      );
    });

    it('returns null when updating an unknown role', async () => {
      expect(await roles.update(UNKNOWN_ID, { name: 'x1' })).toBeNull();
    });

    it('takes a deleted role away from every user', async () => {
      const editor = await roles.create(aRole({ name: 'editor' }));
      const support = await roles.create(aRole({ name: 'support' }));
      const user = await users.create(aUser({ roleIds: [editor.id, support.id] }));

      expect(await roles.delete(editor.id)).toBe(true);

      expect(await roles.findById(editor.id)).toBeNull();
      expect((await users.findById(user.id))?.roles.map((role) => role.name)).toEqual(['support']);
      expect(await roles.delete(editor.id)).toBe(false);
    });
  });
}
