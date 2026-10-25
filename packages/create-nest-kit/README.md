# create-nest-kit

A wizard that generates a ready-to-run NestJS 12 API. Pick the HTTP platform, the database and
ORM, the auth style and the validation library; every combination generates the same modules and serves the same
[HTTP contract](https://github.com/yhagus/create-nest-kit/blob/main/docs/contract.md).

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh
```

Not published to npm yet; the installer downloads the CLI from the GitHub Release.

## Where your project goes

The URL always stays `yhagus/create-nest-kit`: that's where the installer lives. **Your** project's
name goes in the wizard, or after `sh -s --`.

The project is created **inside the folder you run the command from**:

```sh
cd ~/code/apps
INSTALL=https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh
curl -fsSL $INSTALL | sh                     # asks for a name, e.g. billing-api → ~/code/apps/billing-api
curl -fsSL $INSTALL | sh -s -- billing-api   # same folder, without asking for the name
curl -fsSL $INSTALL | sh -s -- .             # uses ~/code/apps itself (asks first if it isn't empty)
```

- A path works too: `sh -s -- services/billing-api` creates `~/code/apps/services/billing-api`.
- You don't need an existing repository. The CLI creates the folder, and runs `git init` in it
  unless you pass `--no-git` (or it is already inside a repository).
- The package name (`name` in `package.json`, `APP_NAME` in `.env`) is the folder's name. When that
  isn't a valid npm package name (say, `.` inside `My Apps`), the wizard asks for one and suggests
  `my-apps`. Set it yourself with `--name my-apps`; with `--yes` it is required in that case.

Generated projects include authentication with refresh-token rotation, email verification,
password reset and change, roles and permissions, session management with immediate revocation,
CSRF protection, rate limiting, BullMQ queues, queued mail (Mailpit in development), pino logging,
health checks, Swagger UI, unit, contract and e2e tests (Testcontainers), `docker-compose.yml`, a
`Dockerfile` and a GitHub Actions workflow.

Requires Node.js ≥ 24.15. The generated project's e2e tests need Docker.

## Options

| Option             | Choices (default first)                                                           | Flag                                                  |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Project folder     | `nest-api`, created in the current folder; `.` uses the current folder itself     | positional `[dir]`                                    |
| Package name       | the folder's name; asked when that isn't a valid npm package name                 | `--name <package-name>`                               |
| HTTP platform      | Fastify · Express                                                                 | `--platform fastify\|express`                         |
| Database           | PostgreSQL · MongoDB                                                              | `--db postgres\|mongodb`                              |
| ORM / ODM          | PostgreSQL: Drizzle · Prisma 7 · TypeORM · MikroORM. MongoDB: Mongoose            | `--orm drizzle\|prisma\|typeorm\|mikroorm\|mongoose`  |
| Auth style         | Hand-rolled `@nestjs/jwt` + argon2id · official `@nestjs/authentication` (scrypt) | `--auth jwt\|nest`                                    |
| Validation library | Zod · class-validator · Valibot · ArkType                                         | `--validation zod\|class-validator\|valibot\|arktype` |
| Email verification | on · off                                                                          | `--[no-]email-verification`                           |
| CSRF protection    | on · off                                                                          | `--[no-]csrf`                                         |
| Package manager    | `--pm`, else asked among the installed ones (pnpm first); npm with `--yes`        | `--pm pnpm\|npm\|yarn\|bun`                           |
| Install            | yes · no                                                                          | `--no-install`                                        |
| Git repository     | yes · no                                                                          | `--no-git`                                            |

MongoDB works only with Mongoose; the SQL ORMs only with PostgreSQL. Any option given as a flag is
not asked for, and `--yes` takes the defaults for the rest:

```sh
INSTALL=https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh
curl -fsSL $INSTALL | sh -s -- my-api --yes --platform express --orm prisma --auth nest
curl -fsSL $INSTALL | sh -s -- my-api --yes --db mongodb --no-csrf
curl -fsSL $INSTALL | sh -s -- my-api --yes --dry-run   # show the plan, write nothing
```

Run with `--help` for every flag. Source, docs and issues:
[github.com/yhagus/create-nest-kit](https://github.com/yhagus/create-nest-kit).

## License

MIT
