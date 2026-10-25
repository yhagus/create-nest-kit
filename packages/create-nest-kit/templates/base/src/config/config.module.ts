import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config.js';
import type { Env } from './env.js';

/**
 * Serves an environment that `createApp()` already validated: the cookie secret is
 * needed before Nest creates the app, and each test app gets its own environment.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [() => env],
        }),
      ],
      providers: [AppConfig],
      exports: [AppConfig],
    };
  }
}
