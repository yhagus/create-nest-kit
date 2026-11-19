import { Module } from '@nestjs/common';
import { CommandHandlers } from './commands/handlers/index.js';
import { QueryHandlers } from './queries/handlers/index.js';
import { UsersController } from './users.controller.js';

/**
 * User management. The repositories come from the global DatabaseModule and
 * `PasswordHasher` from the global AuthModule.
 */
@Module({
  controllers: [UsersController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class UsersModule {}
