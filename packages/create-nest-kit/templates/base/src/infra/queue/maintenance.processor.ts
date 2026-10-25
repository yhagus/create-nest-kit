import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { discoverProviders } from '../../common/discover-providers.js';
import { ExpiredDataPurger, isExpiredDataPurger } from './expired-data-purger.js';
import { MAINTENANCE_QUEUE } from './queue-names.js';

interface NamedPurger {
  name: string;
  purger: ExpiredDataPurger;
}

/** Runs the daily purge: every `@ExpiredDataPurger()` provider, one after the other. */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);
  private purgers: NamedPurger[] = [];

  constructor(private readonly discovery: DiscoveryService) {
    super();
  }

  onModuleInit(): void {
    this.purgers = discoverProviders(this.discovery, ExpiredDataPurger, '@ExpiredDataPurger()').map(
      (wrapper) => {
        if (!isExpiredDataPurger(wrapper.instance)) {
          throw new Error(`${wrapper.name} is an @ExpiredDataPurger() without purgeExpired()`);
        }
        return { name: wrapper.name, purger: wrapper.instance };
      },
    );
  }

  async process(): Promise<void> {
    const now = new Date();
    for (const { name, purger } of this.purgers) {
      const deleted = await purger.purgeExpired(now);
      this.logger.log(`${name} purged ${deleted} expired rows`);
    }
  }
}
