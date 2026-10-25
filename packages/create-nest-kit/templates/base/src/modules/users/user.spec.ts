import { describe, expect, it } from 'vitest';
import { Permission } from '../permissions/permission.js';
import { permissionsOf } from './user.js';

describe('permissionsOf', () => {
  it('unites the permissions of every role, each once, in declaration order', () => {
    const roles = [
      { id: '1', name: 'support', permissions: [Permission.SessionsRead, Permission.UsersRead] },
      { id: '2', name: 'auditor', permissions: [Permission.UsersRead, Permission.RolesRead] },
    ];

    expect(permissionsOf({ roles })).toEqual([
      Permission.UsersRead,
      Permission.RolesRead,
      Permission.SessionsRead,
    ]);
  });

  it('gives a user without roles no permissions', () => {
    expect(permissionsOf({ roles: [] })).toEqual([]);
  });
});
