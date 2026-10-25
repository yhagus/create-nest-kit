import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshTokensRepository } from '../auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../auth/verification-tokens.repository.js';
import { AuthTokenDocuments } from './auth-token-documents.js';
import { MongooseRefreshTokensRepository } from './repositories/mongoose-refresh-tokens.repository.js';
import { MongooseVerificationTokensRepository } from './repositories/mongoose-verification-tokens.repository.js';
import {
  SessionRefreshTokenRecord,
  SessionRefreshTokenSchema,
} from './schemas/session-refresh-token.schema.js';
import {
  VerificationTokenRecord,
  VerificationTokenSchema,
} from './schemas/verification-token.schema.js';

/** Binds the hand-rolled auth's storage ports to Mongoose. Imported by AuthModule. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SessionRefreshTokenRecord.name, schema: SessionRefreshTokenSchema },
      { name: VerificationTokenRecord.name, schema: VerificationTokenSchema },
    ]),
  ],
  providers: [
    AuthTokenDocuments,
    { provide: RefreshTokensRepository, useClass: MongooseRefreshTokensRepository },
    { provide: VerificationTokensRepository, useClass: MongooseVerificationTokensRepository },
  ],
  exports: [RefreshTokensRepository, VerificationTokensRepository],
})
export class AuthPersistenceModule {}
