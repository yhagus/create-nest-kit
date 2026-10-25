import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { DependentDocuments } from './dependent-documents.js';
import { AuthEmailTokenRecord } from './schemas/auth-email-token.schema.js';
import { AuthRefreshTokenRecord } from './schemas/auth-refresh-token.schema.js';
import { AuthSessionRecord } from './schemas/auth-session.schema.js';

/**
 * Deletes `@nestjs/authentication`'s documents with their owners: refresh tokens with their
 * device session (`sessionId`, the SQL variants' `on delete cascade`), and everything of a
 * deleted user. Not part of `MongooseAuthenticationStore`, because Nest discovers a class by
 * one decorator only, and that one is `@ExpiredDataPurger()`.
 */
@Injectable()
@DependentDocuments()
export class AuthTokenDocuments implements DependentDocuments {
  constructor(
    @InjectModel(AuthRefreshTokenRecord.name)
    private readonly refreshTokens: Model<AuthRefreshTokenRecord>,
    @InjectModel(AuthEmailTokenRecord.name)
    private readonly emailTokens: Model<AuthEmailTokenRecord>,
    @InjectModel(AuthSessionRecord.name)
    private readonly sessions: Model<AuthSessionRecord>,
  ) {}

  /** The SQL variants keep these rows past the user (their user ids are opaque); nothing needs them. */
  async deleteForUsers(userIds: readonly string[], session: ClientSession): Promise<void> {
    const ofUsers = { userId: { $in: userIds } };
    await this.refreshTokens.deleteMany(ofUsers, { session });
    await this.emailTokens.deleteMany(ofUsers, { session });
    await this.sessions.deleteMany(ofUsers, { session });
  }

  async deleteForSessions(sessionIds: readonly string[], session: ClientSession): Promise<void> {
    await this.refreshTokens.deleteMany({ sessionId: { $in: sessionIds } }, { session });
  }
}
