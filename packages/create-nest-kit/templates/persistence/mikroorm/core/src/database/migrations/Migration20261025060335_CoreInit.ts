import { Migration } from '@mikro-orm/migrations';

export class Migration20261025060335_CoreInit extends Migration {
  override name = 'Migration20261025060335_CoreInit';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "roles" ("id" uuid not null, "name" text not null, "description" text not null, "permissions" text[] not null, "is_system" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(`alter table "roles" add constraint "roles_name_unique" unique ("name");`);

    this.addSql(
      `create table "users" ("id" uuid not null, "email" text not null, "password_hash" text not null, "name" text not null, "email_verified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(
      `create table "sessions" ("id" uuid not null, "user_id" uuid not null, "user_agent" text null, "ip" text null, "created_at" timestamptz not null, "last_used_at" timestamptz not null, "expires_at" timestamptz not null, "absolute_expires_at" timestamptz not null, "revoked_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(`create index "sessions_expires_at_index" on "sessions" ("expires_at");`);
    this.addSql(`create index "sessions_user_id_index" on "sessions" ("user_id");`);

    this.addSql(
      `create table "user_roles" ("user_id" uuid not null, "role_id" uuid not null, primary key ("user_id", "role_id"));`,
    );
    this.addSql(`create index "user_roles_role_id_index" on "user_roles" ("role_id");`);

    this.addSql(
      `alter table "sessions" add constraint "sessions_user_id_users_id_fk" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_roles" add constraint "user_roles_user_id_users_id_fk" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_role_id_roles_id_fk" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user_roles" drop constraint "user_roles_role_id_roles_id_fk";`);
    this.addSql(`alter table "sessions" drop constraint "sessions_user_id_users_id_fk";`);
    this.addSql(`alter table "user_roles" drop constraint "user_roles_user_id_users_id_fk";`);

    this.addSql(`drop table if exists "roles" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "sessions" cascade;`);
    this.addSql(`drop table if exists "user_roles" cascade;`);
  }
}
