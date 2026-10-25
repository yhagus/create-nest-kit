import type { MfaState } from '@nestjs/authentication';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * `@nestjs/authentication`'s cookie sessions (`SessionRecord`). This app signs in with tokens
 * and keeps device sessions in `sessions`, so the table stays empty, but password reset
 * needs a session store to end them in.
 */
@Entity({ name: 'auth_sessions' })
@Index('auth_sessions_user_id_index', ['userId'])
@Index('auth_sessions_expires_at_index', ['expiresAt'])
export class AuthSessionEntity {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'auth_sessions_pkey' })
  id!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_active_at', type: 'timestamptz' })
  lastActiveAt!: Date;

  @Column({ type: 'text', nullable: true })
  mfa!: MfaState | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
