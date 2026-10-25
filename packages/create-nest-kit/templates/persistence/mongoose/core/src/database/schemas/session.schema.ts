import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { v7 as uuidv7 } from 'uuid';

/** No `timestamps` option: the service decides `createdAt`, and there is no `updatedAt`. */
@Schema({ collection: 'sessions', versionKey: false })
export class SessionRecord {
  /** A UUIDv7, so ids sort by creation time. */
  @Prop({ type: String, default: () => uuidv7() })
  _id!: string;

  /** Indexed for listing and revoking a user's sessions. */
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;

  /** Indexed for the daily purge. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, required: true })
  absoluteExpiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export const SessionSchema = SchemaFactory.createForClass(SessionRecord);
