import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { RefreshTokenFamilies } from '../auth/refresh-token-families.js';
import { AuthEmailTokenEntity } from './entities/auth-email-token.entity.js';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity.js';
import { AuthSessionEntity } from './entities/auth-session.entity.js';
import { MikroOrmAuthenticationStore } from './repositories/mikro-orm-authentication.store.js';

/**
 * Registers `@nestjs/authentication`'s stores on MikroORM (from the store's constructor) and
 * binds the app's own extra port to the same class. Imported by AuthModule.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([AuthRefreshTokenEntity, AuthEmailTokenEntity, AuthSessionEntity]),
  ],
  providers: [
    MikroOrmAuthenticationStore,
    { provide: RefreshTokenFamilies, useExisting: MikroOrmAuthenticationStore },
  ],
  exports: [RefreshTokenFamilies, MikroOrmAuthenticationStore],
})
export class AuthPersistenceModule {}
