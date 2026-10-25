# create-nest-kit

A wizard that generates a ready-to-run NestJS 12 API. Pick the HTTP platform, the database and
ORM, the auth style and the validation library; every combination generates the same modules and serves the same
[HTTP contract](https://github.com/yhagus/create-nest-kit/blob/main/docs/contract.md).

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh
```

Not published to npm yet; the installer downloads the CLI from the GitHub Release.

Generated projects include authentication with refresh-token rotation, email verification,
password reset and change, roles and permissions, session management with immediate revocation,
CSRF protection, rate limiting, BullMQ queues, queued mail (Mailpit in development), pino logging,
health checks, Swagger UI, unit, contract and e2e tests (Testcontainers), `docker-compose.yml`, a
`Dockerfile` and a GitHub Actions workflow.

Requires Node.js ≥ 24.15. The generated project's e2e tests need Docker.

## Options

| Option             | Choices (default first)                                                           | Flag                                                  |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Directory          | `nest-api`                                                                        | positional `[dir]`                                    |
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
