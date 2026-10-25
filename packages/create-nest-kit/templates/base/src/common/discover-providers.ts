import type { DiscoveryService } from '@nestjs/core';

type ProviderWrapper = ReturnType<DiscoveryService['getProviders']>[number];

/**
 * The providers decorated with `decorator`, made by `DiscoveryService.createDecorator()`.
 *
 * Nest links a class to one such decorator only: a second one on the same class silently
 * overwrites the first, and the provider vanishes from the first one's discovery. This throws
 * instead, so the mistake fails at startup rather than disabling a feature without a trace.
 */
export function discoverProviders(
  discovery: DiscoveryService,
  decorator: { KEY: string },
  decoratorName: string,
): ProviderWrapper[] {
  const discovered = discovery.getProviders({ metadataKey: decorator.KEY });
  const discoveredClasses = new Set(discovered.map(providerClass));
  const lostClassNames = discovery
    .getProviders()
    .map(providerClass)
    .filter((providerType) => typeof providerType === 'function')
    .filter(
      (providerType) =>
        Reflect.hasOwnMetadata(decorator.KEY, providerType) && !discoveredClasses.has(providerType),
    )
    .map((providerType) => providerType.name);

  if (lostClassNames.length > 0) {
    const names = [...new Set(lostClassNames)].join(', ');
    throw new Error(
      `${names} has ${decoratorName} but Nest did not discover it. A class can carry only one ` +
        'DiscoveryService.createDecorator() decorator; check it for a second one.',
    );
  }
  return discovered;
}

/** The class Nest reads discovery metadata from: the instance's, for factory and value providers. */
function providerClass(wrapper: ProviderWrapper): unknown {
  const instance: unknown = wrapper.instance;
  return typeof instance === 'object' && instance !== null
    ? instance.constructor
    : wrapper.metatype;
}
