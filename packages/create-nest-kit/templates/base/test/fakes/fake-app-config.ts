import type { AppConfig } from '../../src/config/app-config.js';
import type { Env } from '../../src/config/env.js';

/** An `AppConfig` serving only `values`; reading any other key fails the test. */
export function fakeAppConfig(values: Partial<Env>): Pick<AppConfig, 'get'> {
  return {
    get<Key extends keyof Env>(key: Key): Env[Key] {
      const value = values[key];
      if (value === undefined) throw new Error(`fakeAppConfig has no value for ${key}`);
      return value;
    },
  };
}
