import type { EmailTokenPurpose } from '@nestjs/authentication';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** `@nestjs/authentication`'s password-reset and email-verification links, by the SHA-256 of the token. */
@Schema({ collection: 'auth_email_tokens', versionKey: false })
export class AuthEmailTokenRecord {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true })
  purpose!: EmailTokenPurpose;

  /** Indexed together with `purpose` to delete a user's links of one kind. */
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, default: null })
  fingerprint!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  /** Indexed for pruning, the cap on pending links and the daily purge. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;
}

export const AuthEmailTokenSchema = SchemaFactory.createForClass(AuthEmailTokenRecord);
AuthEmailTokenSchema.index({ userId: 1, purpose: 1 });
