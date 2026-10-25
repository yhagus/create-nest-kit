import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { RefreshTokensRepository } from '../auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../auth/verification-tokens.repository.js';
import { SessionRefreshTokenEntity } from './entities/session-refresh-token.entity.js';
import { VerificationTokenEntity } from './entities/verification-token.entity.js';
import { MikroOrmRefreshTokensRepository } from './repositories/mikro-orm-refresh-tokens.repository.js';
import { MikroOrmVerificationTokensRepository } from './repositories/mikro-orm-verification-tokens.repository.js';

/** Binds the hand-rolled auth's storage ports to MikroORM. Imported by AuthModule. */
@Module({
  imports: [MikroOrmModule.forFeature([SessionRefreshTokenEntity, VerificationTokenEntity])],
  providers: [
    { provide: RefreshTokensRepository, useClass: MikroOrmRefreshTokensRepository },
    { provide: VerificationTokensRepository, useClass: MikroOrmVerificationTokensRepository },
  ],
  exports: [RefreshTokensRepository, VerificationTokensRepository],
})
export class AuthPersistenceModule {}
