import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import { type Mailable, Mailer } from '@nestjs/mail';
import type { Job } from 'bullmq';
import { MAIL_QUEUE } from '../queue/queue-names.js';
import { MAILABLES } from './mail-registry.js';
import type { MailJob } from './mail.queue.js';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  constructor(private readonly mailer: Mailer) {
    super();
  }

  async process(job: Job<MailJob>): Promise<void> {
    const { mail, to, data } = job.data;
    // MailQueue.enqueue() only accepts data that fits the named mail.
    const mailable: Type<Mailable<MailJob['data']>> = MAILABLES[mail];
    await this.mailer.send(mailable, {
      to,
      data,
      // BullMQ retries the job with backoff; the job id makes a retried send recognisable as a duplicate.
      retry: false,
      idempotencyKey: job.id,
    });
  }
}
