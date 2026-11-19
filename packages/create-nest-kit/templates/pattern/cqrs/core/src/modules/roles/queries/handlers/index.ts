import { GetRoleByNameHandler } from './get-role-by-name.handler.js';
import { GetRoleHandler } from './get-role.handler.js';
import { ListRolesHandler } from './list-roles.handler.js';

export const QueryHandlers = [GetRoleByNameHandler, GetRoleHandler, ListRolesHandler];
