import { Global, Module } from '@nestjs/common';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { PrismaService } from './prisma.service.js';
import { PrismaRolesRepository } from './repositories/prisma-roles.repository.js';
import { PrismaSessionsRepository } from './repositories/prisma-sessions.repository.js';
import { PrismaUsersRepository } from './repositories/prisma-users.repository.js';

/**
 * Provides the Prisma client (connected on startup, disconnected on shutdown) and binds every
 * repository port to its Prisma implementation. Global, so domain modules inject the ports
 * without importing it.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    { provide: UsersRepository, useClass: PrismaUsersRepository },
    { provide: RolesRepository, useClass: PrismaRolesRepository },
    { provide: SessionsRepository, useClass: PrismaSessionsRepository },
  ],
  exports: [PrismaService, UsersRepository, RolesRepository, SessionsRepository],
})
export class DatabaseModule {}
