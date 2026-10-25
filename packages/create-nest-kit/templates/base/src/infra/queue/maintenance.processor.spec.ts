import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { ExpiredDataPurger } from './expired-data-purger.js';
import { MaintenanceProcessor } from './maintenance.processor.js';

@Injectable()
@ExpiredDataPurger()
class RecordingPurger implements ExpiredDataPurger {
  readonly purgedAt: Date[] = [];

  async purgeExpired(now: Date): Promise<number> {
    this.purgedAt.push(now);
    return 0;
  }
}

@Injectable()
@ExpiredDataPurger()
class OtherRecordingPurger extends RecordingPurger {}

describe('MaintenanceProcessor', () => {
  it('runs every registered purger with the same clock reading', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [MaintenanceProcessor, RecordingPurger, OtherRecordingPurger],
    }).compile();
    await moduleRef.init();

    await moduleRef.get(MaintenanceProcessor).process();

    const [first] = moduleRef.get(RecordingPurger).purgedAt;
    expect(first).toBeInstanceOf(Date);
    expect(moduleRef.get(OtherRecordingPurger).purgedAt).toEqual([first]);
  });
});
