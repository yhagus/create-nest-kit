import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AppConfig } from '../../config/app-config.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';
import { MAIL_QUEUE, MAINTENANCE_QUEUE } from './queue-names.js';

/** The BullMQ connection and the app's queues. Import it to `@InjectQueue()` one of them. */
@Module({
  imports: [
    // Finds the @ExpiredDataPurger() providers for the maintenance job, whichever module declares them.
    DiscoveryModule,
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ connection: { url: config.get('REDIS_URL') } }),
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }, { name: MAINTENANCE_QUEUE }),
  ],
  providers: [MaintenanceScheduler, MaintenanceProcessor],
  exports: [BullModule],
})
export class QueueModule {}
