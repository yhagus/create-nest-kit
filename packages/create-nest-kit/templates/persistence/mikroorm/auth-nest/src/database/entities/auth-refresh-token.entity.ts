import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { SessionEntity } from './session.entity.js';

/**
 * `@nestjs/authentication`'s refresh tokens (`RefreshTokenRecord`), stored by the SHA-256 of
 * the token. A family counts as revoked when any of its tokens is, so a revocation also covers
 * tokens a racing refresh saves after it. `session_id` is the device session of the sign-in
 * (`claims.sid`); its tokens go when the session row does.
 */
@Entity({ tableName: 'auth_refresh_tokens' })
@Index({ name: 'auth_refresh_tokens_family_id_index', properties: ['familyId'] })
@Index({ name: 'auth_refresh_tokens_user_id_index', properties: ['userId'] })
@Index({ name: 'auth_refresh_tokens_session_id_index', properties: ['sessionId'] })
@Index({ name: 'auth_refresh_tokens_family_expires_at_index', properties: ['familyExpiresAt'] })
export class AuthRefreshTokenEntity {
  @PrimaryKey({ type: 'text' })
  id!: string;

  @Property({ type: 'text' })
  familyId!: string;

  /** Text, not a foreign key: the package's user ids are opaque strings. */
  @Property({ type: 'text' })
  userId!: string;

  /** The session's id (`mapToPk`), not the session entity. */
  @ManyToOne(() => SessionEntity, {
    mapToPk: true,
    nullable: true,
    fieldName: 'session_id',
    deleteRule: 'cascade',
    foreignKeyName: 'auth_refresh_tokens_session_id_sessions_id_fk',
  })
  sessionId!: string | null;

  @Property({ type: 'datetime' })
  createdAt!: Date;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'datetime' })
  familyExpiresAt!: Date;

  @Property({ type: 'datetime', nullable: true })
  usedAt!: Date | null;

  @Property({ type: 'boolean', default: false })
  revoked!: boolean;

  @Property({ type: 'json', nullable: true })
  claims!: Record<string, unknown> | null;
}
