import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokensRepository } from '../auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../auth/verification-tokens.repository.js';
import { SessionRefreshTokenEntity } from './entities/session-refresh-token.entity.js';
import { VerificationTokenEntity } from './entities/verification-token.entity.js';
import { TypeOrmRefreshTokensRepository } from './repositories/typeorm-refresh-tokens.repository.js';
import { TypeOrmVerificationTokensRepository } from './repositories/typeorm-verification-tokens.repository.js';

/** Binds the hand-rolled auth's storage ports to TypeORM. Imported by AuthModule. */
@Module({
  imports: [TypeOrmModule.forFeature([SessionRefreshTokenEntity, VerificationTokenEntity])],
  providers: [
    { provide: RefreshTokensRepository, useClass: TypeOrmRefreshTokensRepository },
    { provide: VerificationTokensRepository, useClass: TypeOrmVerificationTokensRepository },
  ],
  exports: [RefreshTokensRepository, VerificationTokensRepository],
})
export class AuthPersistenceModule {}
