import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthJwtInit1792907296452 implements MigrationInterface {
  name = 'AuthJwtInit1792907296452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "session_refresh_tokens" ("session_id" uuid NOT NULL, "token_hash" text NOT NULL, CONSTRAINT "session_refresh_tokens_pkey" PRIMARY KEY ("session_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "verification_tokens" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "purpose" text NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE ("token_hash"), CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "verification_tokens_expires_at_index" ON "verification_tokens"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "verification_tokens_user_id_purpose_index" ON "verification_tokens"  ("user_id", "purpose") `,
    );
    await queryRunner.query(
      `ALTER TABLE "session_refresh_tokens" ADD CONSTRAINT "session_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_user_id_users_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session_refresh_tokens" DROP CONSTRAINT "session_refresh_tokens_session_id_sessions_id_fk"`,
    );
    await queryRunner.query(`DROP INDEX "public"."verification_tokens_user_id_purpose_index"`);
    await queryRunner.query(`DROP INDEX "public"."verification_tokens_expires_at_index"`);
    await queryRunner.query(`DROP TABLE "verification_tokens"`);
    await queryRunner.query(`DROP TABLE "session_refresh_tokens"`);
  }
}
