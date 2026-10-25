import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { SessionEntity } from './session.entity.js';

/** The hash of each session's current refresh token; rotation compares and sets `token_hash`. */
@Entity({ tableName: 'session_refresh_tokens' })
export class SessionRefreshTokenEntity {
  /** The session's id (`mapToPk`), not the session entity. */
  @ManyToOne(() => SessionEntity, {
    primary: true,
    mapToPk: true,
    fieldName: 'session_id',
    deleteRule: 'cascade',
    foreignKeyName: 'session_refresh_tokens_session_id_sessions_id_fk',
  })
  sessionId!: string;

  @Property({ type: 'text' })
  tokenHash!: string;
}
