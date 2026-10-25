import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { ClientSession } from 'mongoose';
import { discoverProviders } from '../common/discover-providers.js';

/**
 * Deletes the documents that belong to users or sessions being deleted. MongoDB has no foreign
 * keys to cascade, so the users and sessions repositories call every `DependentDocuments`
 * provider inside the transaction that deletes the owners. Each auth style registers one for
 * the tokens it stores.
 */
export interface DependentDocuments {
  deleteForUsers(userIds: readonly string[], session: ClientSession): Promise<void>;
  deleteForSessions(sessionIds: readonly string[], session: ClientSession): Promise<void>;
}

/**
 * Registers a provider as `DependentDocuments`: decorate its class with
 * `@DependentDocuments()` and implement both methods. Works from any module.
 *
 * Don't combine it with another `DiscoveryService.createDecorator()` decorator (such as
 * `@ExpiredDataPurger()`) on one class: Nest discovers a class by one of them only.
 * `discoverProviders()` then fails at startup; split the class instead.
 */
export const DependentDocuments = DiscoveryService.createDecorator();

function isDependentDocuments(value: unknown): value is DependentDocuments {
  return (
    typeof value === 'object' &&
    value !== null &&
    'deleteForUsers' in value &&
    typeof value.deleteForUsers === 'function' &&
    'deleteForSessions' in value &&
    typeof value.deleteForSessions === 'function'
  );
}

/**
 * Runs every `@DependentDocuments()` provider, whichever module declares it, one after the
 * other: a transaction's session runs one operation at a time.
 */
@Injectable()
export class CascadeDelete implements OnModuleInit {
  private dependents: DependentDocuments[] = [];

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    this.dependents = discoverProviders(
      this.discovery,
      DependentDocuments,
      '@DependentDocuments()',
    ).map((wrapper) => {
      if (!isDependentDocuments(wrapper.instance)) {
        throw new Error(
          `${wrapper.name} is a @DependentDocuments() without deleteForUsers() and deleteForSessions()`,
        );
      }
      return wrapper.instance;
    });
  }

  async deleteForUsers(userIds: readonly string[], session: ClientSession): Promise<void> {
    if (userIds.length === 0) return;
    for (const dependent of this.dependents) {
      await dependent.deleteForUsers(userIds, session);
    }
  }

  async deleteForSessions(sessionIds: readonly string[], session: ClientSession): Promise<void> {
    if (sessionIds.length === 0) return;
    for (const dependent of this.dependents) {
      await dependent.deleteForSessions(sessionIds, session);
    }
  }
}
