import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { v7 as uuidv7 } from 'uuid';
import { VerificationPurpose } from '../../auth/verification-tokens.repository.js';

/**
 * A one-time email-verification or password-reset token, stored as a hash. Deleted with its user.
 * Expired tokens are deleted by the daily purge rather than a TTL index, which would delete them
 * at an unpredictable moment.
 */
@Schema({ collection: 'verification_tokens', versionKey: false })
export class VerificationTokenRecord {
  /** A UUIDv7, so ids sort by creation time. */
  @Prop({ type: String, default: () => uuidv7() })
  _id!: string;

  /** Indexed together with `purpose` to replace a user's earlier token. */
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true, enum: Object.values(VerificationPurpose) })
  purpose!: VerificationPurpose;

  @Prop({ type: String, required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  /** Indexed for the daily purge. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;
}

export const VerificationTokenSchema = SchemaFactory.createForClass(VerificationTokenRecord);
VerificationTokenSchema.index({ userId: 1, purpose: 1 });
