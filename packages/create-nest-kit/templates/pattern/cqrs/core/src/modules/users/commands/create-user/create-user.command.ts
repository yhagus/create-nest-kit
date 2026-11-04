import { Command } from '@nestjs/cqrs';
import type { User } from '../../user.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleIds?: string[];
  emailVerified?: boolean;
}

/** @throws UserEmailTakenException, UnknownRoleIdsException */
export class CreateUserCommand extends Command<User> {
  constructor(readonly input: CreateUserInput) {
    super();
  }
}
