import { Module } from '@nestjs/common';
import { RefreshTokensRepository } from '../auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../auth/verification-tokens.repository.js';
import { PrismaRefreshTokensRepository } from './repositories/prisma-refresh-tokens.repository.js';
import { PrismaVerificationTokensRepository } from './repositories/prisma-verification-tokens.repository.js';

/** Binds the hand-rolled auth's storage ports to Prisma. Imported by AuthModule. */
@Module({
  providers: [
    { provide: RefreshTokensRepository, useClass: PrismaRefreshTokensRepository },
    { provide: VerificationTokensRepository, useClass: PrismaVerificationTokensRepository },
  ],
  exports: [RefreshTokensRepository, VerificationTokensRepository],
})
export class AuthPersistenceModule {}
