import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import type { MailTransport } from '@nestjs/mail';
import { AuthHttpModule } from './auth/auth-http.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './infra/health/health.module.js';
import { LoggerModule } from './infra/logger/logger.module.js';
import { MailModule } from './infra/mail/mail.module.js';
import { QueueModule } from './infra/queue/queue.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { ThrottlerModule } from './infra/throttler/throttler.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { UsersModule } from './modules/users/users.module.js';

export interface AppModuleOptions {
  env: Env;
  /** Replaces the transport MAIL_TRANSPORT selects. The e2e harness passes an InMemoryMailTransport. */
  mailTransport?: MailTransport;
  /** Modules mounted next to the app's own. The e2e suite adds test-only controllers this way. */
  extraImports?: ModuleMetadata['imports'];
}

/**
 * A dynamic module, so the environment is read when an app is created rather than
 * when this file is imported.
 */
@Module({})
export class AppModule {
  static forRoot({ env, mailTransport, extraImports = [] }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule,
        RedisModule,
        DatabaseModule,
        QueueModule,
        MailModule.forRoot({ transport: mailTransport }),
        ThrottlerModule,
        AuthModule,
        AuthHttpModule,
        UsersModule,
        RolesModule,
        PermissionsModule,
        SessionsModule,
        HealthModule,
        ...extraImports,
      ],
    };
  }
}
