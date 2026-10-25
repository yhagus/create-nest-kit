import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthNestInit1792908679680 implements MigrationInterface {
  name = 'AuthNestInit1792908679680';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth_email_tokens" ("id" text NOT NULL, "purpose" text NOT NULL, "user_id" text NOT NULL, "email" text NOT NULL, "fingerprint" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "auth_email_tokens_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_email_tokens_expires_at_index" ON "auth_email_tokens"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_email_tokens_user_id_purpose_index" ON "auth_email_tokens"  ("user_id", "purpose") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_refresh_tokens" ("id" text NOT NULL, "family_id" text NOT NULL, "user_id" text NOT NULL, "session_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "family_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "revoked" boolean NOT NULL DEFAULT false, "claims" jsonb, CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_refresh_tokens_family_expires_at_index" ON "auth_refresh_tokens"  ("family_expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_refresh_tokens_session_id_index" ON "auth_refresh_tokens"  ("session_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_refresh_tokens_user_id_index" ON "auth_refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_refresh_tokens_family_id_index" ON "auth_refresh_tokens"  ("family_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" text NOT NULL, "user_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL, "mfa" text, "metadata" jsonb, CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_expires_at_index" ON "auth_sessions"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_user_id_index" ON "auth_sessions"  ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_tokens" DROP CONSTRAINT "auth_refresh_tokens_session_id_sessions_id_fk"`,
    );
    await queryRunner.query(`DROP INDEX "public"."auth_sessions_user_id_index"`);
    await queryRunner.query(`DROP INDEX "public"."auth_sessions_expires_at_index"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."auth_refresh_tokens_family_id_index"`);
    await queryRunner.query(`DROP INDEX "public"."auth_refresh_tokens_user_id_index"`);
    await queryRunner.query(`DROP INDEX "public"."auth_refresh_tokens_session_id_index"`);
    await queryRunner.query(`DROP INDEX "public"."auth_refresh_tokens_family_expires_at_index"`);
    await queryRunner.query(`DROP TABLE "auth_refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."auth_email_tokens_user_id_purpose_index"`);
    await queryRunner.query(`DROP INDEX "public"."auth_email_tokens_expires_at_index"`);
    await queryRunner.query(`DROP TABLE "auth_email_tokens"`);
  }
}
