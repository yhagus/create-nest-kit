import { CommandBus, CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppConfig } from '../../../config/app-config.js';
import { GetRoleByNameQuery } from '../../../modules/roles/queries/get-role-by-name/get-role-by-name.query.js';
import { SystemRoleName } from '../../../modules/roles/role.js';
import { CreateUserCommand } from '../../../modules/users/commands/create-user/create-user.command.js';
import type { User } from '../../../modules/users/user.js';
import { VerificationMailSender } from '../../verification-mail-sender.js';
import { RegisterCommand } from './register.command.js';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly verificationMail: VerificationMailSender,
    private readonly config: AppConfig,
  ) {}

  async execute({ registration }: RegisterCommand): Promise<User> {
    const userRole = await this.queryBus.execute(new GetRoleByNameQuery(SystemRoleName.User));
    const user = await this.commandBus.execute(
      new CreateUserCommand({ ...registration, roleIds: [userRole.id] }),
    );
    if (this.config.get('EMAIL_VERIFICATION_ENABLED')) {
      await this.verificationMail.send(user);
    }
    return user;
  }
}
