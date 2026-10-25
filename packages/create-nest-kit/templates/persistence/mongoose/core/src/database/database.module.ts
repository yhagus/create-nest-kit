import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/app-config.js';
import { RolesRepository } from '../modules/roles/roles.repository.js';
import { SessionsRepository } from '../modules/sessions/sessions.repository.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { CascadeDelete } from './dependent-documents.js';
import { MongooseRolesRepository } from './repositories/mongoose-roles.repository.js';
import { MongooseSessionsRepository } from './repositories/mongoose-sessions.repository.js';
import { MongooseUsersRepository } from './repositories/mongoose-users.repository.js';
import { RoleRecord, RoleSchema } from './schemas/role.schema.js';
import { SessionRecord, SessionSchema } from './schemas/session.schema.js';
import { UserRecord, UserSchema } from './schemas/user.schema.js';

/**
 * Opens the connection (closed on shutdown) and binds every repository port to its Mongoose
 * implementation. Global, so domain modules inject the ports without importing it.
 * Indexes come from `db:migrate`, never from the app starting (`autoIndex: false`).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.get('MONGODB_URI'),
        autoIndex: false,
      }),
    }),
    MongooseModule.forFeature([
      { name: UserRecord.name, schema: UserSchema },
      { name: RoleRecord.name, schema: RoleSchema },
      { name: SessionRecord.name, schema: SessionSchema },
    ]),
    // Finds the @DependentDocuments() providers, whichever module declares them.
    DiscoveryModule,
  ],
  providers: [
    CascadeDelete,
    { provide: UsersRepository, useClass: MongooseUsersRepository },
    { provide: RolesRepository, useClass: MongooseRolesRepository },
    { provide: SessionsRepository, useClass: MongooseSessionsRepository },
  ],
  exports: [UsersRepository, RolesRepository, SessionsRepository],
})
export class DatabaseModule {}
