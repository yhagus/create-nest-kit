import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
import { MAIL_QUEUE } from '../queue/queue-names.js';
import type { MailDataOf, MailName } from './mail-registry.js';

export interface MailJob<Name extends MailName = MailName> {
  mail: Name;
  to: string;
  data: MailDataOf<Name>;
}

const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  // Job data can hold one-time links, so it is not kept once the mail is out.
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

/** Sends mail in the background: `mailQueue.enqueue({ mail: 'password-changed', to, data: { name } })`. */
@Injectable()
export class MailQueue {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>) {}

  async enqueue<Name extends MailName>(job: MailJob<Name>): Promise<void> {
    await this.queue.add(job.mail, job, MAIL_JOB_OPTIONS);
  }
}
