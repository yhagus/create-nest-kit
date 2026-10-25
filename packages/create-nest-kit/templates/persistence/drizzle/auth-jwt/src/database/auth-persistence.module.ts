import { Module } from '@nestjs/common';
import { RefreshTokensRepository } from '../auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../auth/verification-tokens.repository.js';
import { DrizzleRefreshTokensRepository } from './repositories/drizzle-refresh-tokens.repository.js';
import { DrizzleVerificationTokensRepository } from './repositories/drizzle-verification-tokens.repository.js';

/** Binds the hand-rolled auth's storage ports to Drizzle. Imported by AuthModule. */
@Module({
  providers: [
    { provide: RefreshTokensRepository, useClass: DrizzleRefreshTokensRepository },
    { provide: VerificationTokensRepository, useClass: DrizzleVerificationTokensRepository },
  ],
  exports: [RefreshTokensRepository, VerificationTokensRepository],
})
export class AuthPersistenceModule {}
