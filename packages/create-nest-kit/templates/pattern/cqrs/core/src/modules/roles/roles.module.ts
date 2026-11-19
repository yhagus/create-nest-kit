import { Module } from '@nestjs/common';
import { CommandHandlers } from './commands/handlers/index.js';
import { QueryHandlers } from './queries/handlers/index.js';
import { RolesController } from './roles.controller.js';

/** Role management. `RolesRepository` comes from the global DatabaseModule. */
@Module({
  controllers: [RolesController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class RolesModule {}
