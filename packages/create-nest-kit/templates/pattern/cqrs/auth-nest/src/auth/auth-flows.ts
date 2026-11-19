import type { ModuleMetadata } from '@nestjs/common';
import { CommandHandlers } from './commands/handlers/index.js';

/**
 * The `/auth` flows, registered in AuthModule: the handlers of the `/auth` commands. They reach
 * users, roles and sessions through the buses, so nothing is imported or exported here.
 */
export const AUTH_FLOWS = {
  imports: [],
  providers: [...CommandHandlers],
  exports: [],
} satisfies Required<Pick<ModuleMetadata, 'imports' | 'providers' | 'exports'>>;
