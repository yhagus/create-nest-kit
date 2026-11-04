import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { PasswordHasher } from '../../../../auth/password-hasher.js';
import { RolesRepository } from '../../../roles/roles.repository.js';
import { normalizeEmail } from '../../email.js';
import { existingRoleIds } from '../../existing-role-ids.js';
import type { User } from '../../user.js';
import { UsersRepository } from '../../users.repository.js';
import { CreateUserCommand } from './create-user.command.js';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ input }: CreateUserCommand): Promise<User> {
    const roleIds = await existingRoleIds(this.roles, input.roleIds ?? []);
    return this.users.create({
      email: normalizeEmail(input.email),
      passwordHash: await this.passwordHasher.hash(input.password),
      name: input.name,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      roleIds,
    });
  }
}
