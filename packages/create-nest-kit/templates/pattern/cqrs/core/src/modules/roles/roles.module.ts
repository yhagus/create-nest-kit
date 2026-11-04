import { Module } from '@nestjs/common';
import { CreateRoleHandler } from './commands/create-role/create-role.handler.js';
import { DeleteRoleHandler } from './commands/delete-role/delete-role.handler.js';
import { SyncSystemRolesHandler } from './commands/sync-system-roles/sync-system-roles.handler.js';
import { UpdateRoleHandler } from './commands/update-role/update-role.handler.js';
import { GetRoleByNameHandler } from './queries/get-role-by-name/get-role-by-name.handler.js';
import { GetRoleHandler } from './queries/get-role/get-role.handler.js';
import { ListRolesHandler } from './queries/list-roles/list-roles.handler.js';
import { RolesController } from './roles.controller.js';

/** Role management. `RolesRepository` comes from the global DatabaseModule. */
@Module({
  controllers: [RolesController],
  providers: [
    ListRolesHandler,
    GetRoleHandler,
    GetRoleByNameHandler,
    CreateRoleHandler,
    UpdateRoleHandler,
    DeleteRoleHandler,
    SyncSystemRolesHandler,
  ],
})
export class RolesModule {}
