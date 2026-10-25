import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { v7 as uuidv7 } from 'uuid';

/**
 * A user and the ids of their roles, which stand in for the `user_roles` table of the SQL
 * variants. Nothing enforces that the ids exist; `MongooseUsersRepository` checks them.
 */
@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class UserRecord {
  /** A UUIDv7, so ids sort by creation time. */
  @Prop({ type: String, default: () => uuidv7() })
  _id!: string;

  @Prop({ type: String, required: true, unique: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Date, default: null })
  emailVerifiedAt!: Date | null;

  @Prop({ type: [String], default: [], index: true })
  roleIds!: string[];

  /** Set by the `timestamps` option. */
  createdAt!: Date;

  /** Set by the `timestamps` option on every update. */
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserRecord);
