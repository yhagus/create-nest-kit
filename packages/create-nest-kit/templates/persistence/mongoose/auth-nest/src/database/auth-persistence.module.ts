import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshTokenFamilies } from '../auth/refresh-token-families.js';
import { AuthTokenDocuments } from './auth-token-documents.js';
import { MongooseAuthenticationStore } from './repositories/mongoose-authentication.store.js';
import { AuthEmailTokenRecord, AuthEmailTokenSchema } from './schemas/auth-email-token.schema.js';
import {
  AuthRefreshTokenRecord,
  AuthRefreshTokenSchema,
} from './schemas/auth-refresh-token.schema.js';
import { AuthSessionRecord, AuthSessionSchema } from './schemas/auth-session.schema.js';

/**
 * Registers `@nestjs/authentication`'s stores on Mongoose (from the store's constructor) and
 * binds the app's own extra port to the same class. Imported by AuthModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthRefreshTokenRecord.name, schema: AuthRefreshTokenSchema },
      { name: AuthEmailTokenRecord.name, schema: AuthEmailTokenSchema },
      { name: AuthSessionRecord.name, schema: AuthSessionSchema },
    ]),
  ],
  providers: [
    MongooseAuthenticationStore,
    AuthTokenDocuments,
    { provide: RefreshTokenFamilies, useExisting: MongooseAuthenticationStore },
  ],
  exports: [RefreshTokenFamilies, MongooseAuthenticationStore],
})
export class AuthPersistenceModule {}
