import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { PasswordHasher } from '../../src/auth/password-hasher.js';
import { AppConfig } from '../../src/config/app-config.js';
import type { Env } from '../../src/config/env.js';
import { RolesModule } from '../../src/modules/roles/roles.module.js';
import { RolesRepository } from '../../src/modules/roles/roles.repository.js';
import { SessionDenyList } from '../../src/modules/sessions/session-deny-list.js';
import { SessionsModule } from '../../src/modules/sessions/sessions.module.js';
import { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import { fakeAppConfig } from '../fakes/fake-app-config.js';
import { FakePasswordHasher } from '../fakes/fake-password-hasher.js';
import type { InMemoryRepositories } from '../fakes/in-memory-repositories.js';
import { InMemorySessionDenyList } from '../fakes/in-memory-session-deny-list.js';

export interface HandlerTestingModuleOptions {
  repositories: InMemoryRepositories;
  /** The only config values the handlers can read. */
  config?: Partial<Env>;
  /** Added next to the users, roles and sessions modules, e.g. an auth style's handlers. */
  imports?: ModuleMetadata['imports'];
  providers?: ModuleMetadata['providers'];
}

/**
 * The users, roles and sessions modules on real buses, with in-memory fakes for the ports that
 * DatabaseModule and AuthModule provide in the app. Specs dispatch through `CommandBus` and
 * `QueryBus`, as the controllers do. Call `init()` on the compiled module: it registers the handlers.
 */
export function handlerTestingModule({
  repositories,
  config = {},
  imports = [],
  providers = [],
}: HandlerTestingModuleOptions): TestingModuleBuilder {
  return Test.createTestingModule({
    imports: [
      CqrsModule.forRoot(),
      inMemoryPortsModule(repositories, config),
      UsersModule,
      RolesModule,
      SessionsModule,
      ...imports,
    ],
    providers,
  });
}

@Module({})
class InMemoryPortsModule {}

function inMemoryPortsModule(
  repositories: InMemoryRepositories,
  config: Partial<Env>,
): DynamicModule {
  const providers = [
    { provide: UsersRepository, useValue: repositories.users },
    { provide: RolesRepository, useValue: repositories.roles },
    { provide: SessionsRepository, useValue: repositories.sessions },
    { provide: PasswordHasher, useClass: FakePasswordHasher },
    { provide: SessionDenyList, useClass: InMemorySessionDenyList },
    { provide: AppConfig, useValue: fakeAppConfig(config) },
  ];
  return {
    module: InMemoryPortsModule,
    global: true,
    providers,
    exports: providers.map((provider) => provider.provide),
  };
}
