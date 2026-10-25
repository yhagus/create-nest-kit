import { Module } from '@nestjs/common';
import { RefreshTokenFamilies } from '../auth/refresh-token-families.js';
import { DrizzleAuthenticationStore } from './repositories/drizzle-authentication.store.js';

/**
 * Registers `@nestjs/authentication`'s stores on Drizzle (from the store's constructor) and
 * binds the app's own extra port to the same class. Imported by AuthModule.
 */
@Module({
  providers: [
    DrizzleAuthenticationStore,
    { provide: RefreshTokenFamilies, useExisting: DrizzleAuthenticationStore },
  ],
  exports: [RefreshTokenFamilies, DrizzleAuthenticationStore],
})
export class AuthPersistenceModule {}
