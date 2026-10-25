import type { MfaState } from '@nestjs/authentication';
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

/**
 * `@nestjs/authentication`'s cookie sessions (`SessionRecord`). This app signs in with tokens
 * and keeps device sessions in `sessions`, so the table stays empty, but password reset
 * needs a session store to end them in.
 */
@Entity({ tableName: 'auth_sessions' })
@Index({ name: 'auth_sessions_user_id_index', properties: ['userId'] })
@Index({ name: 'auth_sessions_expires_at_index', properties: ['expiresAt'] })
export class AuthSessionEntity {
  @PrimaryKey({ type: 'text' })
  id!: string;

  @Property({ type: 'text' })
  userId!: string;

  @Property({ type: 'datetime' })
  createdAt!: Date;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'datetime' })
  lastActiveAt!: Date;

  @Property({ type: 'text', nullable: true })
  mfa!: MfaState | null;

  @Property({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
