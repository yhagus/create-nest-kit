import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { v7 as uuidv7 } from 'uuid';
import type { Permission } from '../../modules/permissions/permission.js';

@Schema({ collection: 'roles', timestamps: true, versionKey: false })
export class RoleRecord {
  /** A UUIDv7, so ids sort by creation time. */
  @Prop({ type: String, default: () => uuidv7() })
  _id!: string;

  @Prop({ type: String, required: true, unique: true })
  name!: string;

  /** Not `required`: Mongoose would reject an empty description. */
  @Prop({ type: String, default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  permissions!: Permission[];

  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /** Set by the `timestamps` option. */
  createdAt!: Date;

  /** Set by the `timestamps` option on every update. */
  updatedAt!: Date;
}

export const RoleSchema = SchemaFactory.createForClass(RoleRecord);
