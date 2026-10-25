import { Module } from '@nestjs/common';
import { RefreshTokenFamilies } from '../auth/refresh-token-families.js';
import { PrismaAuthenticationStore } from './repositories/prisma-authentication.store.js';

/**
 * Registers `@nestjs/authentication`'s stores on Prisma (from the store's constructor) and
 * binds the app's own extra port to the same class. Imported by AuthModule.
 */
@Module({
  providers: [
    PrismaAuthenticationStore,
    { provide: RefreshTokenFamilies, useExisting: PrismaAuthenticationStore },
  ],
  exports: [RefreshTokenFamilies, PrismaAuthenticationStore],
})
export class AuthPersistenceModule {}
