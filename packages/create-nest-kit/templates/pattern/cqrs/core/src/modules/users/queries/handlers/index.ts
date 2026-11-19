import { FindUserByEmailHandler } from './find-user-by-email.handler.js';
import { GetUserHandler } from './get-user.handler.js';
import { ListUsersHandler } from './list-users.handler.js';

export const QueryHandlers = [FindUserByEmailHandler, GetUserHandler, ListUsersHandler];
