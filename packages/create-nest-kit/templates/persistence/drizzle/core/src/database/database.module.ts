import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AppConfig } from '../config/app-config.js';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { DrizzleRolesRepository } from './repositories/drizzle-roles.repository.js';
import { DrizzleSessionsRepository } from './repositories/drizzle-sessions.repository.js';
import { DrizzleUsersRepository } from './repositories/drizzle-users.repository.js';

/**
 * Opens the connection pool (closed on shutdown) and binds every repository port to its
 * Drizzle implementation. Global, so domain modules inject the ports without importing it.
 * Inject the database itself with `@InjectDatabase()` from `./database.ts`.
 */
@Global()
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        drizzle,
        connection: config.get('DATABASE_URL'),
        casing: 'snake_case' as const,
      }),
    }),
  ],
  providers: [
    { provide: UsersRepository, useClass: DrizzleUsersRepository },
    { provide: RolesRepository, useClass: DrizzleRolesRepository },
    { provide: SessionsRepository, useClass: DrizzleSessionsRepository },
  ],
  exports: [UsersRepository, RolesRepository, SessionsRepository],
})
export class DatabaseModule {}
