import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE, PURGE_EXPIRED_JOB } from './queue-names.js';

const EVERY_DAY_AT_3AM = '0 3 * * *';

/** Registers the daily purge. Upserting keeps a single schedule however many instances start. */
@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      PURGE_EXPIRED_JOB,
      { pattern: EVERY_DAY_AT_3AM },
      { name: PURGE_EXPIRED_JOB },
    );
  }
}
