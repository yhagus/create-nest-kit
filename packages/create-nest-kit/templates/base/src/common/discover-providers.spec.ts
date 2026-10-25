import { Injectable } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { discoverProviders } from './discover-providers.js';

const Audited = DiscoveryService.createDecorator();
const Cached = DiscoveryService.createDecorator();

// Decorators apply bottom-up: @Audited() runs last and takes the class's only discovery link.
@Injectable()
@Audited()
@Cached()
class AuditedAndCachedService {}

describe('discoverProviders', () => {
  it('fails when a second discovery decorator on the class hid it from this one', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [AuditedAndCachedService],
    }).compile();
    const discovery = moduleRef.get(DiscoveryService);

    expect(() => discoverProviders(discovery, Cached, '@Cached()')).toThrow(
      'AuditedAndCachedService has @Cached() but Nest did not discover it',
    );
  });
});
