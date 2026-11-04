import { DiscoveryService } from '@nestjs/core';

/** Deletes rows that expired at or before `now`, for the daily maintenance job. */
export interface ExpiredDataPurger {
  /** Returns how many rows it deleted. */
  purgeExpired(now: Date): Promise<number>;
}

/**
 * Registers a provider with the daily purge: decorate its class with `@ExpiredDataPurger()`
 * and implement `purgeExpired()`. Works from any module, so each auth style purges its own tokens.
 */
export const ExpiredDataPurger = DiscoveryService.createDecorator();

export function isExpiredDataPurger(value: unknown): value is ExpiredDataPurger {
  return (
    typeof value === 'object' &&
    value !== null &&
    'purgeExpired' in value &&
    typeof value.purgeExpired === 'function'
  );
}
