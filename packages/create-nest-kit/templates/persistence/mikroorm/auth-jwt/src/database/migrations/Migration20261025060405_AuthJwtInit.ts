import { Migration } from '@mikro-orm/migrations';

export class Migration20261025060405_AuthJwtInit extends Migration {
  override name = 'Migration20261025060405_AuthJwtInit';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "session_refresh_tokens" ("session_id" uuid not null, "token_hash" text not null, primary key ("session_id"));`,
    );

    this.addSql(
      `create table "verification_tokens" ("id" uuid not null, "user_id" uuid not null, "purpose" text not null, "token_hash" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "verification_tokens_expires_at_index" on "verification_tokens" ("expires_at");`,
    );
    this.addSql(
      `create index "verification_tokens_user_id_purpose_index" on "verification_tokens" ("user_id", "purpose");`,
    );
    this.addSql(
      `alter table "verification_tokens" add constraint "verification_tokens_token_hash_unique" unique ("token_hash");`,
    );

    this.addSql(
      `alter table "session_refresh_tokens" add constraint "session_refresh_tokens_session_id_sessions_id_fk" foreign key ("session_id") references "sessions" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "verification_tokens" add constraint "verification_tokens_user_id_users_id_fk" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "session_refresh_tokens" cascade;`);
    this.addSql(`drop table if exists "verification_tokens" cascade;`);
  }
}
