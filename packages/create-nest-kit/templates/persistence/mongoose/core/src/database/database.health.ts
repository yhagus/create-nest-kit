import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type { Connection } from 'mongoose';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      if (!this.connection.db) throw new Error('Not connected');
      await this.connection.db.command({ ping: 1 });
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Database is unreachable' });
    }
  }
}
