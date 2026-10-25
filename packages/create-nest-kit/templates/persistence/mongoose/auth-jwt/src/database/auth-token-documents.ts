import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { DependentDocuments } from './dependent-documents.js';
import { SessionRefreshTokenRecord } from './schemas/session-refresh-token.schema.js';
import { VerificationTokenRecord } from './schemas/verification-token.schema.js';

/**
 * Deletes the hand-rolled auth's tokens with their owners: refresh tokens with their session,
 * verification tokens with their user. The SQL variants do this with `on delete cascade`.
 */
@Injectable()
@DependentDocuments()
export class AuthTokenDocuments implements DependentDocuments {
  constructor(
    @InjectModel(SessionRefreshTokenRecord.name)
    private readonly refreshTokens: Model<SessionRefreshTokenRecord>,
    @InjectModel(VerificationTokenRecord.name)
    private readonly verificationTokens: Model<VerificationTokenRecord>,
  ) {}

  async deleteForUsers(userIds: readonly string[], session: ClientSession): Promise<void> {
    await this.verificationTokens.deleteMany({ userId: { $in: userIds } }, { session });
  }

  async deleteForSessions(sessionIds: readonly string[], session: ClientSession): Promise<void> {
    await this.refreshTokens.deleteMany({ _id: { $in: sessionIds } }, { session });
  }
}
