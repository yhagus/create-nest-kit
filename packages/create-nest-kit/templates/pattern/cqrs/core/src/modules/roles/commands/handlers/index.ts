import { CreateRoleHandler } from './create-role.handler.js';
import { DeleteRoleHandler } from './delete-role.handler.js';
import { SyncSystemRolesHandler } from './sync-system-roles.handler.js';
import { UpdateRoleHandler } from './update-role.handler.js';

export const CommandHandlers = [
  CreateRoleHandler,
  DeleteRoleHandler,
  SyncSystemRolesHandler,
  UpdateRoleHandler,
];
