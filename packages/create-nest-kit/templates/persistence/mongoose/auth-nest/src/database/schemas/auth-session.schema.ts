import type { MfaState } from '@nestjs/authentication';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

/**
 * `@nestjs/authentication`'s cookie sessions (`SessionRecord`). This app signs in with tokens
 * and keeps device sessions in `sessions`, so the collection stays empty, but password reset
 * needs a session store to end them in.
 */
@Schema({ collection: 'auth_sessions', versionKey: false })
export class AuthSessionRecord {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  /** Indexed for pruning and the daily purge. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, required: true })
  lastActiveAt!: Date;

  @Prop({ type: String, default: null })
  mfa!: MfaState | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  metadata!: Record<string, unknown> | null;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSessionRecord);
