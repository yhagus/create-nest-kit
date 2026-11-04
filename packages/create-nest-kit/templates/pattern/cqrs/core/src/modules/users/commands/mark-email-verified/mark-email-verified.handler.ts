import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../users.repository.js';
import { UserNotFoundException } from '../../users.exceptions.js';
import { MarkEmailVerifiedCommand } from './mark-email-verified.command.js';

@CommandHandler(MarkEmailVerifiedCommand)
export class MarkEmailVerifiedHandler implements ICommandHandler<MarkEmailVerifiedCommand> {
  constructor(private readonly users: UsersRepository) {}

  async execute({ userId }: MarkEmailVerifiedCommand): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundException();
    if (user.emailVerifiedAt === null) {
      await this.users.update(userId, { emailVerifiedAt: new Date() });
    }
  }
}
