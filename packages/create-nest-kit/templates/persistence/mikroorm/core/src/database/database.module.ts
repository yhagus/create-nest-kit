import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { RoleEntity } from './entities/role.entity.js';
import { SessionEntity } from './entities/session.entity.js';
import { UserRoleEntity } from './entities/user-role.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { MikroOrmRolesRepository } from './repositories/mikro-orm-roles.repository.js';
import { MikroOrmSessionsRepository } from './repositories/mikro-orm-sessions.repository.js';
import { MikroOrmUsersRepository } from './repositories/mikro-orm-users.repository.js';

/**
 * Opens the MikroORM connection (closed on shutdown) and binds every repository port to its
 * MikroORM implementation. Global, so domain modules inject the ports without importing it.
 * The schema comes from the migrations in `./migrations/`, never from the schema generator.
 */
@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      // Here rather than in the factory's result: the module needs the driver before the factory
      // runs, to provide the driver's EntityManager (the one with createQueryBuilder()).
      driver: PostgreSqlDriver,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        clientUrl: config.get('DATABASE_URL'),
        // Every entity registered with MikroOrmModule.forFeature(), here and in other modules.
        autoLoadEntities: true,
      }),
    }),
    MikroOrmModule.forFeature([UserEntity, RoleEntity, UserRoleEntity, SessionEntity]),
  ],
  providers: [
    { provide: UsersRepository, useClass: MikroOrmUsersRepository },
    { provide: RolesRepository, useClass: MikroOrmRolesRepository },
    { provide: SessionsRepository, useClass: MikroOrmSessionsRepository },
  ],
  exports: [UsersRepository, RolesRepository, SessionsRepository],
})
export class DatabaseModule {}
