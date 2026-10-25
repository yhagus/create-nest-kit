import { Column, Entity, ForeignKey, Index, PrimaryColumn } from 'typeorm';
import { SessionEntity } from './session.entity.js';

/**
 * `@nestjs/authentication`'s refresh tokens (`RefreshTokenRecord`), stored by the SHA-256 of
 * the token. A family counts as revoked when any of its tokens is, so a revocation also covers
 * tokens a racing refresh saves after it. `session_id` is the device session of the sign-in
 * (`claims.sid`); its tokens go when the session row does.
 */
@Entity({ name: 'auth_refresh_tokens' })
@Index('auth_refresh_tokens_family_id_index', ['familyId'])
@Index('auth_refresh_tokens_user_id_index', ['userId'])
@Index('auth_refresh_tokens_session_id_index', ['sessionId'])
@Index('auth_refresh_tokens_family_expires_at_index', ['familyExpiresAt'])
export class AuthRefreshTokenEntity {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'auth_refresh_tokens_pkey' })
  id!: string;

  @Column({ name: 'family_id', type: 'text' })
  familyId!: string;

  // Text, not a foreign key: the package's user ids are opaque strings.
  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  @ForeignKey(() => SessionEntity, {
    name: 'auth_refresh_tokens_session_id_sessions_id_fk',
    onDelete: 'CASCADE',
  })
  sessionId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'family_expires_at', type: 'timestamptz' })
  familyExpiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  claims!: Record<string, unknown> | null;
}
