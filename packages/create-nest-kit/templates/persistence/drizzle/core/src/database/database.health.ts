import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { type Database, InjectDatabase } from './database.js';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.db.execute(sql`select 1`);
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Database is unreachable' });
    }
  }
}
