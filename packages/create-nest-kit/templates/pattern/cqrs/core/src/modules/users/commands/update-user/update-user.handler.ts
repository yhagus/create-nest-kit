import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { PasswordHasher } from '../../../../auth/password-hasher.js';
import { RolesRepository } from '../../../roles/roles.repository.js';
import { RevokeAllUserSessionsCommand } from '../../../sessions/commands/revoke-all-user-sessions/revoke-all-user-sessions.command.js';
import { normalizeEmail } from '../../email.js';
import { existingRoleIds } from '../../existing-role-ids.js';
import type { User } from '../../user.js';
import { type UserChanges, UsersRepository } from '../../users.repository.js';
import { UserNotFoundException } from '../../users.exceptions.js';
import { UpdateUserCommand, type UpdateUserInput } from './update-user.command.js';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ id, input }: UpdateUserCommand): Promise<User> {
    const user = await this.users.update(id, await this.toChanges(input));
    if (!user) throw new UserNotFoundException();
    if (input.password !== undefined) {
      await this.commandBus.execute(new RevokeAllUserSessionsCommand(id));
    }
    return user;
  }

  private async toChanges(input: UpdateUserInput): Promise<UserChanges> {
    const changes: UserChanges = {};
    if (input.email !== undefined) changes.email = normalizeEmail(input.email);
    if (input.name !== undefined) changes.name = input.name;
    if (input.password !== undefined) {
      changes.passwordHash = await this.passwordHasher.hash(input.password);
    }
    if (input.emailVerified !== undefined) {
      changes.emailVerifiedAt = input.emailVerified ? new Date() : null;
    }
    if (input.roleIds !== undefined) {
      changes.roleIds = await existingRoleIds(this.roles, input.roleIds);
    }
    return changes;
  }
}
