import { CreateUserHandler } from './create-user.handler.js';
import { DeleteUserHandler } from './delete-user.handler.js';
import { MarkEmailVerifiedHandler } from './mark-email-verified.handler.js';
import { SetPasswordHandler } from './set-password.handler.js';
import { UpdateUserHandler } from './update-user.handler.js';

export const CommandHandlers = [
  CreateUserHandler,
  DeleteUserHandler,
  MarkEmailVerifiedHandler,
  SetPasswordHandler,
  UpdateUserHandler,
];
