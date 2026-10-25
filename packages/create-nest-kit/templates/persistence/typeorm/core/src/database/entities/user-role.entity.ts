import {
  Entity,
  ForeignKey,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { RoleEntity } from './role.entity.js';
import { UserEntity } from './user.entity.js';

export const USER_ROLES_ROLE_FK = 'user_roles_role_id_roles_id_fk';

/** One role given to one user. */
@Entity({ name: 'user_roles' })
// The primary key serves lookups by user; deleting a role looks them up by role.
@Index('user_roles_role_id_index', ['roleId'])
export class UserRoleEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', primaryKeyConstraintName: 'user_roles_pkey' })
  @ForeignKey(() => UserEntity, { name: 'user_roles_user_id_users_id_fk', onDelete: 'CASCADE' })
  userId!: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid', primaryKeyConstraintName: 'user_roles_pkey' })
  roleId!: string;

  /** Loaded with `relations: { role: true }` to read a user's roles in one query. */
  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id', foreignKeyConstraintName: USER_ROLES_ROLE_FK })
  role!: Relation<RoleEntity>;
}
