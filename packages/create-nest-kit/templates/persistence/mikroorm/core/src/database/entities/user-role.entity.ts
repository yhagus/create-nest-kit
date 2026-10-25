import { Entity, Index, ManyToOne } from '@mikro-orm/decorators/legacy';
import { RoleEntity } from './role.entity.js';
import { UserEntity } from './user.entity.js';

export const USER_ROLES_ROLE_FK = 'user_roles_role_id_roles_id_fk';

/**
 * One role given to one user. Both columns are foreign keys mapped to the plain id
 * (`mapToPk`), so rows are read and written as ids, without loading either entity.
 */
@Entity({ tableName: 'user_roles' })
// The primary key serves lookups by user; deleting a role looks them up by role.
@Index({ name: 'user_roles_role_id_index', properties: ['roleId'] })
export class UserRoleEntity {
  @ManyToOne(() => UserEntity, {
    primary: true,
    mapToPk: true,
    fieldName: 'user_id',
    deleteRule: 'cascade',
    foreignKeyName: 'user_roles_user_id_users_id_fk',
  })
  userId!: string;

  @ManyToOne(() => RoleEntity, {
    primary: true,
    mapToPk: true,
    fieldName: 'role_id',
    deleteRule: 'cascade',
    foreignKeyName: USER_ROLES_ROLE_FK,
  })
  roleId!: string;
}
