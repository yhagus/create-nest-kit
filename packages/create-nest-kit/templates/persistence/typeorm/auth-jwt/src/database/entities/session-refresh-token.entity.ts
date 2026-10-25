import { Column, Entity, ForeignKey, PrimaryColumn } from 'typeorm';
import { SessionEntity } from './session.entity.js';

/** The hash of each session's current refresh token; rotation compares and sets `token_hash`. */
@Entity({ name: 'session_refresh_tokens' })
export class SessionRefreshTokenEntity {
  @PrimaryColumn({
    name: 'session_id',
    type: 'uuid',
    primaryKeyConstraintName: 'session_refresh_tokens_pkey',
  })
  @ForeignKey(() => SessionEntity, {
    name: 'session_refresh_tokens_session_id_sessions_id_fk',
    onDelete: 'CASCADE',
  })
  sessionId!: string;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;
}
