import type { EmailTokenPurpose } from '@nestjs/authentication';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** `@nestjs/authentication`'s password-reset and email-verification links, by the SHA-256 of the token. */
@Entity({ name: 'auth_email_tokens' })
@Index('auth_email_tokens_user_id_purpose_index', ['userId', 'purpose'])
@Index('auth_email_tokens_expires_at_index', ['expiresAt'])
export class AuthEmailTokenEntity {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'auth_email_tokens_pkey' })
  id!: string;

  @Column({ type: 'text' })
  purpose!: EmailTokenPurpose;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', nullable: true })
  fingerprint!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
