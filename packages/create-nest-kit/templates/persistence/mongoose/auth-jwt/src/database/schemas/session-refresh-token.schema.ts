import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** The hash of a session's current refresh token. Deleted with its session. */
@Schema({ collection: 'session_refresh_tokens', versionKey: false })
export class SessionRefreshTokenRecord {
  /** The session's id: one token per session. */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true })
  tokenHash!: string;
}

export const SessionRefreshTokenSchema = SchemaFactory.createForClass(SessionRefreshTokenRecord);
