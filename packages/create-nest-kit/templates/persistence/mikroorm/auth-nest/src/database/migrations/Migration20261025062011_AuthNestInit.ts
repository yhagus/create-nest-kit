import { Migration } from '@mikro-orm/migrations';

export class Migration20261025062011_AuthNestInit extends Migration {
  override name = 'Migration20261025062011_AuthNestInit';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "auth_email_tokens" ("id" text not null, "purpose" text not null, "user_id" text not null, "email" text not null, "fingerprint" text null, "created_at" timestamptz not null, "expires_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "auth_email_tokens_expires_at_index" on "auth_email_tokens" ("expires_at");`,
    );
    this.addSql(
      `create index "auth_email_tokens_user_id_purpose_index" on "auth_email_tokens" ("user_id", "purpose");`,
    );

    this.addSql(
      `create table "auth_sessions" ("id" text not null, "user_id" text not null, "created_at" timestamptz not null, "expires_at" timestamptz not null, "last_active_at" timestamptz not null, "mfa" text null, "metadata" jsonb null, primary key ("id"));`,
    );
    this.addSql(`create index "auth_sessions_expires_at_index" on "auth_sessions" ("expires_at");`);
    this.addSql(`create index "auth_sessions_user_id_index" on "auth_sessions" ("user_id");`);

    this.addSql(
      `create table "auth_refresh_tokens" ("id" text not null, "family_id" text not null, "user_id" text not null, "session_id" uuid null, "created_at" timestamptz not null, "expires_at" timestamptz not null, "family_expires_at" timestamptz not null, "used_at" timestamptz null, "revoked" boolean not null default false, "claims" jsonb null, primary key ("id"));`,
    );
    this.addSql(
      `create index "auth_refresh_tokens_family_expires_at_index" on "auth_refresh_tokens" ("family_expires_at");`,
    );
    this.addSql(
      `create index "auth_refresh_tokens_session_id_index" on "auth_refresh_tokens" ("session_id");`,
    );
    this.addSql(
      `create index "auth_refresh_tokens_user_id_index" on "auth_refresh_tokens" ("user_id");`,
    );
    this.addSql(
      `create index "auth_refresh_tokens_family_id_index" on "auth_refresh_tokens" ("family_id");`,
    );

    this.addSql(
      `alter table "auth_refresh_tokens" add constraint "auth_refresh_tokens_session_id_sessions_id_fk" foreign key ("session_id") references "sessions" ("id") on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "auth_email_tokens" cascade;`);
    this.addSql(`drop table if exists "auth_sessions" cascade;`);
    this.addSql(`drop table if exists "auth_refresh_tokens" cascade;`);
  }
}
