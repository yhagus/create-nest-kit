import { Module } from '@nestjs/common';
import { CreateUserHandler } from './commands/create-user/create-user.handler.js';
import { DeleteUserHandler } from './commands/delete-user/delete-user.handler.js';
import { MarkEmailVerifiedHandler } from './commands/mark-email-verified/mark-email-verified.handler.js';
import { SetPasswordHandler } from './commands/set-password/set-password.handler.js';
import { UpdateUserHandler } from './commands/update-user/update-user.handler.js';
import { FindUserByEmailHandler } from './queries/find-user-by-email/find-user-by-email.handler.js';
import { GetUserHandler } from './queries/get-user/get-user.handler.js';
import { ListUsersHandler } from './queries/list-users/list-users.handler.js';
import { UsersController } from './users.controller.js';

/**
 * User management. The repositories come from the global DatabaseModule and
 * `PasswordHasher` from the global AuthModule.
 */
@Module({
  controllers: [UsersController],
  providers: [
    ListUsersHandler,
    GetUserHandler,
    FindUserByEmailHandler,
    CreateUserHandler,
    UpdateUserHandler,
    SetPasswordHandler,
    MarkEmailVerifiedHandler,
    DeleteUserHandler,
  ],
})
export class UsersModule {}
