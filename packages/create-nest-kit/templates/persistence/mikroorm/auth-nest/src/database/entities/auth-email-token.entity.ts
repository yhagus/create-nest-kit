import type { EmailTokenPurpose } from '@nestjs/authentication';
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

/** `@nestjs/authentication`'s password-reset and email-verification links, by the SHA-256 of the token. */
@Entity({ tableName: 'auth_email_tokens' })
@Index({ name: 'auth_email_tokens_user_id_purpose_index', properties: ['userId', 'purpose'] })
@Index({ name: 'auth_email_tokens_expires_at_index', properties: ['expiresAt'] })
export class AuthEmailTokenEntity {
  @PrimaryKey({ type: 'text' })
  id!: string;

  @Property({ type: 'text' })
  purpose!: EmailTokenPurpose;

  @Property({ type: 'text' })
  userId!: string;

  @Property({ type: 'text' })
  email!: string;

  @Property({ type: 'text', nullable: true })
  fingerprint!: string | null;

  @Property({ type: 'datetime' })
  createdAt!: Date;

  @Property({ type: 'datetime' })
  expiresAt!: Date;
}
