import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenFamilies } from '../auth/refresh-token-families.js';
import { AuthEmailTokenEntity } from './entities/auth-email-token.entity.js';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity.js';
import { AuthSessionEntity } from './entities/auth-session.entity.js';
import { TypeOrmAuthenticationStore } from './repositories/typeorm-authentication.store.js';

/**
 * Registers `@nestjs/authentication`'s stores on TypeORM (from the store's constructor) and
 * binds the app's own extra port to the same class. Imported by AuthModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthRefreshTokenEntity, AuthEmailTokenEntity, AuthSessionEntity]),
  ],
  providers: [
    TypeOrmAuthenticationStore,
    { provide: RefreshTokenFamilies, useExisting: TypeOrmAuthenticationStore },
  ],
  exports: [RefreshTokenFamilies, TypeOrmAuthenticationStore],
})
export class AuthPersistenceModule {}
