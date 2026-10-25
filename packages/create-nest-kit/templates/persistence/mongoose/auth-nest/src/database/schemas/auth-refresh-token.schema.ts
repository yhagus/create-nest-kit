import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

/**
 * `@nestjs/authentication`'s refresh tokens (`RefreshTokenRecord`), stored by the SHA-256 of
 * the token. A family counts as revoked when any of its tokens is, so a revocation also covers
 * tokens a racing refresh saves after it. `sessionId` is the device session of the sign-in
 * (`claims.sid`); its tokens are deleted with the session.
 */
@Schema({ collection: 'auth_refresh_tokens', versionKey: false })
export class AuthRefreshTokenRecord {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  familyId!: string;

  /** A plain string: the package's user ids are opaque. */
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, default: null, index: true })
  sessionId!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Indexed for pruning and the daily purge. */
  @Prop({ type: Date, required: true, index: true })
  familyExpiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt!: Date | null;

  @Prop({ type: Boolean, default: false })
  revoked!: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  claims!: Record<string, unknown> | null;
}

export const AuthRefreshTokenSchema = SchemaFactory.createForClass(AuthRefreshTokenRecord);
