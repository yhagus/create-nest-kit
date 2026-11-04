import { NestFactory } from '@nestjs/core';
import { type NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from '../app.module.js';
import { parseEnv } from '../config/env.js';
import { configureApp } from './configure-app.js';

export type CreateAppOptions = Partial<AppModuleOptions>;

/** Builds the app without listening. `env` defaults to the validated `process.env`. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestNodeApplication> {
  const env = options.env ?? parseEnv(process.env);
  // As on Express, the request id comes from the pino-http middleware (see LoggerModule).
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule.forRoot({ ...options, env }),
    // Behind a reverse proxy, trustProxy makes `request.ip` the client's address from X-Forwarded-For.
    new NodeAdapter({ trustProxy: env.TRUST_PROXY }),
    { bufferLogs: true, cookies: { secret: env.COOKIE_SECRET } },
  );
  app.useLogger(app.get(Logger));
  configureApp(app);
  return app;
}
