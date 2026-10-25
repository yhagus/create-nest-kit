import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly em: EntityManager,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  // A query rather than `orm.checkConnection()`, which reports a pool that has not run a query
  // yet as down.
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.em.fork().execute('select 1');
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Database is unreachable' });
    }
  }
}
