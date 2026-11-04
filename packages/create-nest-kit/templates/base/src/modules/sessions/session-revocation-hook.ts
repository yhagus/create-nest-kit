import { DiscoveryService } from '@nestjs/core';

/**
 * Runs after sessions are revoked, for state that lives outside the `sessions` table,
 * e.g. the refresh-token families an auth library keeps itself.
 */
export interface SessionRevocationHook {
  onSessionsRevoked(sessionIds: string[]): Promise<void>;
}

/**
 * Registers a provider as a `SessionRevocationHook`: decorate its class with
 * `@SessionRevocationHook()` and implement `onSessionsRevoked()`. Works from any module.
 */
export const SessionRevocationHook = DiscoveryService.createDecorator();

export function isSessionRevocationHook(value: unknown): value is SessionRevocationHook {
  return (
    typeof value === 'object' &&
    value !== null &&
    'onSessionsRevoked' in value &&
    typeof value.onSessionsRevoked === 'function'
  );
}
