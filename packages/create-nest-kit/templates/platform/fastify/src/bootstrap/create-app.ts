import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from '../app.module.js';
import { parseEnv } from '../config/env.js';
import { genReqId } from '../infra/logger/request-id.js';
import { configureApp } from './configure-app.js';

export type CreateAppOptions = Partial<AppModuleOptions>;

/** Builds the app without listening. `env` defaults to the validated `process.env`. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  const env = options.env ?? parseEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ ...options, env }),
    // Fastify assigns the request id before any middleware runs, so the generator goes here.
    // Behind a reverse proxy, trustProxy makes `request.ip` the client's address from X-Forwarded-For.
    new FastifyAdapter({ genReqId, trustProxy: env.TRUST_PROXY }),
    { bufferLogs: true, cookies: { secret: env.COOKIE_SECRET } },
  );
  app.useLogger(app.get(Logger));
  configureApp(app);
  return app;
}
