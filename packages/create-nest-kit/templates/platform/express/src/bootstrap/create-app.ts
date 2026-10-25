import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from '../app.module.js';
import { parseEnv } from '../config/env.js';
import { configureApp } from './configure-app.js';

export type CreateAppOptions = Partial<AppModuleOptions>;

/** Builds the app without listening. `env` defaults to the validated `process.env`. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestExpressApplication> {
  const env = options.env ?? parseEnv(process.env);
  // On Express the request id comes from the pino-http middleware (see LoggerModule).
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot({ ...options, env }),
    {
      bufferLogs: true,
      cookies: { secret: env.COOKIE_SECRET },
    },
  );
  app.useLogger(app.get(Logger));
  // Behind a reverse proxy, this makes `request.ip` the client's address from X-Forwarded-For.
  app.set('trust proxy', env.TRUST_PROXY);
  configureApp(app);
  return app;
}
