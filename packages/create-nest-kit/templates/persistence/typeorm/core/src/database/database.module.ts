import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/app-config.js';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { RoleEntity } from './entities/role.entity.js';
import { SessionEntity } from './entities/session.entity.js';
import { UserRoleEntity } from './entities/user-role.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { TypeOrmRolesRepository } from './repositories/typeorm-roles.repository.js';
import { TypeOrmSessionsRepository } from './repositories/typeorm-sessions.repository.js';
import { TypeOrmUsersRepository } from './repositories/typeorm-users.repository.js';

/**
 * Opens the data source (closed on shutdown) and binds every repository port to its TypeORM
 * implementation. Global, so domain modules inject the ports without importing it.
 * The schema comes from the migrations in `./migrations/`, never from `synchronize`.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL'),
        // Every entity registered with TypeOrmModule.forFeature(), here and in other modules.
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, RoleEntity, UserRoleEntity, SessionEntity]),
  ],
  providers: [
    { provide: UsersRepository, useClass: TypeOrmUsersRepository },
    { provide: RolesRepository, useClass: TypeOrmRolesRepository },
    { provide: SessionsRepository, useClass: TypeOrmSessionsRepository },
  ],
  exports: [UsersRepository, RolesRepository, SessionsRepository],
})
export class DatabaseModule {}
