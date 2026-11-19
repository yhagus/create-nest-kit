import { Global, Module } from '@nestjs/common';
import { FileTemplateEngine, MailModule as NestMailModule } from '@nestjs/mail';
import { join } from 'node:path';
import { AppConfig } from '../../config/app-config.js';
import { QueueModule } from '../queue/queue.module.js';
import { MAILABLES } from './mail-registry.js';
import { MailProcessor } from './mail.processor.js';
import { MailQueue } from './mail.queue.js';
import { createMailTransport } from './mail-transport.js';

/** Copied next to the compiled code by the `assets` entry in nest-cli.json. */
const TEMPLATES_DIR = join(import.meta.dirname, 'templates');

/** Global, so any module can queue mail with `MailQueue`. */
@Global()
@Module({
  imports: [
    QueueModule,
    NestMailModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        transport: createMailTransport(config),
        templates: new FileTemplateEngine({ dir: TEMPLATES_DIR, layout: 'layout' }),
        from: config.get('MAIL_FROM'),
      }),
    }),
  ],
  providers: [MailQueue, MailProcessor, ...Object.values(MAILABLES)],
  exports: [MailQueue],
})
export class MailModule {}
