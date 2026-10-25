import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../../test/fakes/in-memory-repositories.js';
import { ALL_PERMISSIONS, Permission } from '../permissions/permission.js';
import { RolesRepository } from './roles.repository.js';
import { RolesService } from './roles.service.js';

describe('RolesService', () => {
  let rolesService: RolesService;
  let rolesRepository: RolesRepository;

  beforeEach(async () => {
    rolesRepository = createInMemoryRepositories().roles;
    const moduleRef = await Test.createTestingModule({
      providers: [RolesService, { provide: RolesRepository, useValue: rolesRepository }],
    }).compile();
    rolesService = moduleRef.get(RolesService);
  });

  it('creates a custom role, granting each permission once', async () => {
    const role = await rolesService.createRole({
      name: 'support',
      permissions: [Permission.UsersRead, Permission.SessionsRead, Permission.UsersRead],
    });

    expect(role).toMatchObject({
      name: 'support',
      description: '',
      permissions: [Permission.UsersRead, Permission.SessionsRead],
      isSystem: false,
    });
  });

  describe('system roles', () => {
    beforeEach(async () => {
      await rolesService.syncSystemRoles();
    });

    it('creates admin with every permission and user with none', async () => {
      expect(await rolesRepository.findByName('admin')).toMatchObject({
        isSystem: true,
        permissions: ALL_PERMISSIONS,
      });
      expect(await rolesRepository.findByName('user')).toMatchObject({
        isSystem: true,
        permissions: [],
      });
    });

    it('gives admin back every permission on the next sync, and leaves user alone', async () => {
      const admin = await rolesService.getRoleByName('admin');
      const user = await rolesService.getRoleByName('user');
      await rolesRepository.update(admin.id, { permissions: [Permission.UsersRead] });
      await rolesService.updateRole(user.id, { permissions: [Permission.UsersRead] });

      await rolesService.syncSystemRoles();

      expect((await rolesService.getRole(admin.id)).permissions).toEqual(ALL_PERMISSIONS);
      expect((await rolesService.getRole(user.id)).permissions).toEqual([Permission.UsersRead]);
    });

    it('lets a system role change its description, sent along with its unchanged name', async () => {
      const user = await rolesService.getRoleByName('user');

      const updated = await rolesService.updateRole(user.id, {
        name: 'user',
        description: 'Everyone who signed up',
      });

      expect(updated.description).toBe('Everyone who signed up');
    });
  });

  it('deletes a custom role', async () => {
    const role = await rolesService.createRole({ name: 'support', permissions: [] });

    await rolesService.deleteRole(role.id);

    await expect(rolesService.getRole(role.id)).rejects.toThrow(NotFoundException);
  });
});
