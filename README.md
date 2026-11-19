<div align="center">

# create-nest-kit

**A production-ready NestJS 12 API, built from the stack you pick.**

Choose the HTTP platform, database, ORM, auth style, validation library, pattern and folder layout.
Every combo generates the same modules and serves the same HTTP contract; only the code behind it differs.

[![Latest release](https://img.shields.io/github/v/release/yhagus/create-nest-kit?label=release)](https://github.com/yhagus/create-nest-kit/releases/latest)
[![CI](https://github.com/yhagus/create-nest-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/yhagus/create-nest-kit/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/yhagus/create-nest-kit)](LICENSE)

[Quick start](#quick-start) • [What you get](#what-you-get) • [Wizard options](#wizard-options) • [Contributing](#contributing)

</div>

---

## Quick start

```sh
curl -fsSL https://github.com/yhagus/create-nest-kit/releases/latest/download/install.sh | sh
```

The installer comes from the [latest release](https://github.com/yhagus/create-nest-kit/releases/latest). It checks the requirements, downloads the CLI from the same release, verifies its SHA-256 checksum and starts the wizard. Then:

```sh
cd nest-api
docker compose up -d   # Postgres or MongoDB, Redis and Mailpit
npm run db:migrate && npm run db:seed
npm run start:dev      # http://localhost:3000, Swagger UI at /docs
```

The generated project's own README has the exact commands for the package manager and dev environment you picked.

---

## Why create-nest-kit?

- **One contract, many stacks.** 480 combos of platform, ORM, auth style, validation library, pattern and layout all serve the endpoints, payloads and error codes in [docs/contract.md](docs/contract.md). Swapping a stack choice never changes what your clients see.
- **The boring parts, done properly.** Refresh-token rotation with reuse detection, sessions you can revoke instantly, deny-by-default permissions, CSRF, rate limiting and queued mail come wired and tested.
- **Tested in every combo.** Each generated project ships feature tests that drive the app over HTTP, its scripts and its start-up, against real databases, Redis and Mailpit. Every release generates all 480 combos and runs their checks before it is published.
- **No lock-in to the generator.** The output is a plain NestJS project with no runtime dependency on create-nest-kit. Generate it once and own it.

---

## What you get

- **Auth:** register, login, refresh-token rotation with reuse detection, logout, profile; email verification (toggle); forgot, reset and change password.
- **Authorization:** roles plus permissions declared as a TypeScript enum, with deny-by-default access decorators (`@Public()`, `@Authenticated()`, `@RequirePermissions(...)`).
- **Users, roles and sessions:** list your sessions, revoke one or all others; revoked access tokens stop working immediately.
- **Security:** CSRF protection (toggle), security headers, CORS, Redis-backed rate limiting.
- **Infrastructure:** BullMQ queues, mail through a queue (Mailpit in development), pino logging with request ids, health checks at `/health`, Swagger UI at `/docs`, an env schema validated at startup.
- **Tests:** feature tests in `tests/<feature>/`, which call the API, run `db:migrate` and `db:seed` and boot the app against real Postgres or MongoDB, Redis and Mailpit (Testcontainers), asserting only what a client can observe.
- **Tooling:** TypeScript 6, Vitest, oxlint, Prettier, `docker-compose.yml`, a `Dockerfile` and a GitHub Actions CI workflow.

The feature tests in every generated project are the executable form of [docs/contract.md](docs/contract.md).

---

## Install

### Requirements

- Node.js 24.15 or later. The installer stops with a hint when it is missing or older; install it from [nodejs.org](https://nodejs.org) or with `fnm install 24` / `nvm install 24`.
- `curl` or `wget`, `tar`, and one of `sha256sum`, `shasum` or `openssl` (present on macOS and most Linux distributions).
- npm, pnpm, yarn or bun, to install the generated project's dependencies.
- Docker, to run the generated project (`docker compose up`, `test`). git is optional; without it the CLI skips `git init`.

**Windows:** run the installer inside [WSL](https://learn.microsoft.com/windows/wsl/install). There is no PowerShell installer yet.

create-nest-kit is not published to npm, so `npm create nest-kit` does not work.

### Passing options

Arguments after `sh -s --` go to the CLI (see [Wizard options](#wizard-options)):

```sh
INSTALL=https://github.com/yhagus/create-nest-kit/releases/latest/download/install.sh

curl -fsSL $INSTALL | sh -s -- my-api --orm prisma
curl -fsSL $INSTALL | sh -s -- my-api --yes
```

### Pinning a version

Each release carries its own `install.sh`, which installs that release:

```sh
curl -fsSL https://github.com/yhagus/create-nest-kit/releases/download/v1.0.0/install.sh | sh
```

`NEST_KIT_VERSION` overrides it with any tag from the [releases page](https://github.com/yhagus/create-nest-kit/releases).

### Reading the script first

```sh
curl -fsSLO https://github.com/yhagus/create-nest-kit/releases/latest/download/install.sh
less install.sh
sh install.sh my-api
```

The wizard reads its answers from the terminal even when the script comes through a pipe. Where there is no terminal (CI, containers), pass `--yes`.

### Where your project goes

The project is created inside the folder you run the command from. Its name goes in the wizard, or after `sh -s --`:

```sh
cd ~/code/apps
curl -fsSL $INSTALL | sh                     # asks for a name, e.g. billing-api → ~/code/apps/billing-api
curl -fsSL $INSTALL | sh -s -- billing-api   # same folder, without asking for the name
curl -fsSL $INSTALL | sh -s -- .             # uses ~/code/apps itself (asks first if it isn't empty)
```

- A path works too: `sh -s -- services/billing-api` creates `~/code/apps/services/billing-api`.
- You don't need an existing repository. The CLI creates the folder and runs `git init` in it, unless you pass `--no-git` or it is already inside a repository.
- The package name (`name` in `package.json`, `APP_NAME` in `.env`) is the folder's name. When that isn't a valid npm package name (say, `.` inside `My Apps`), the wizard asks for one and suggests `my-apps`. Set it yourself with `--name my-apps`; with `--yes` it is required in that case.

---

## Wizard options

Any option given as a flag is not asked for. With `--yes`, everything not given takes its default.

| Option              | Choices (default first)                                                                                                                                                 | Flag                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Project folder      | `nest-api`, created in the current folder; `.` uses the current folder itself                                                                                           | positional `[dir]`                                    |
| Package name        | the folder's name; asked when that isn't a valid npm package name                                                                                                       | `--name <package-name>`                               |
| Project type        | API only · API + web (a Nuxt front end in `web/`, run with bun)                                                                                                         | `--type api\|fullstack`                               |
| HTTP platform       | Fastify · Express · Node (native `node:http`, `@nestjs/platform-node`)                                                                                                  | `--platform fastify\|express\|node`                   |
| Database            | PostgreSQL · MongoDB                                                                                                                                                    | `--db postgres\|mongodb`                              |
| ORM / ODM           | PostgreSQL: Drizzle · Prisma 7 · TypeORM · MikroORM. MongoDB: Mongoose                                                                                                  | `--orm drizzle\|prisma\|typeorm\|mikroorm\|mongoose`  |
| Auth style          | Hand-rolled `@nestjs/jwt` + argon2id · official `@nestjs/authentication` + `@nestjs/authorization`                                                                      | `--auth jwt\|nest`                                    |
| Validation library  | Zod · class-validator · Valibot · ArkType                                                                                                                               | `--validation zod\|class-validator\|valibot\|arktype` |
| Application pattern | Controller + service · CQRS (`@nestjs/cqrs`, with the role folders of its official example)                                                                             | `--pattern service\|cqrs`                             |
| Folder layout       | Nested (`src/modules/`, `src/common/`, `src/infra/`, relative imports) · Flat (one `src/<module>/` per module, shared code in `src/libs/`, `@/` imports across modules) | `--layout nested\|flat`                               |
| Email verification  | on · off                                                                                                                                                                | `--[no-]email-verification`                           |
| CSRF protection     | on · off                                                                                                                                                                | `--[no-]csrf`                                         |
| Package manager     | `--pm`, else asked among the installed ones (pnpm first); npm with `--yes`                                                                                              | `--pm pnpm\|npm\|yarn\|bun`                           |
| Dev environment     | Local Node.js (databases in Docker) · Docker (the API in a container too)                                                                                               | `--dev-env local\|docker`                             |
| Install             | yes · no                                                                                                                                                                | `--no-install`                                        |
| Git repository      | yes · no (skipped inside an existing repository)                                                                                                                        | `--no-git`                                            |

Other flags: `--dry-run` shows what would be generated and writes nothing, `--force` writes into a non-empty folder without asking (files with the same name are replaced, nothing is deleted), `-h, --help`, `-v, --version`.

**Compatibility.** MongoDB works only with Mongoose, so the wizard picks it without asking; the four SQL ORMs work only with PostgreSQL. A flag combination that breaks this rule fails before anything is written, with a hint (`--orm drizzle is not available for MongoDB; use --orm mongoose or --db postgres`).

**Toggles.** Email verification and CSRF only set defaults in `.env` (`EMAIL_VERIFICATION_ENABLED`, `CSRF_ENABLED`); the code for both is always generated.

**Pattern.** With CQRS, each feature module keeps only its module and controllers at its root. Everything else sits in role folders: `commands/{handlers,impl}`, `queries/{handlers,impl}`, `models`, `providers`, `schemas`, `guards` and `decorators`.

**Layout.** The flat layout follows the nested one file for file: `src/modules/<module>/` and `src/infra/<module>/` become `src/<module>/`, and `src/common/` becomes `src/libs/`. An import that leaves its module uses the `@/` alias for `src/`, declared in `tsconfig.json`; Vitest resolves it, and `nest build` rewrites it in `dist/`.

**Dev environment.** It only changes `docker-compose.yml` and the README's quick start. With `docker`, compose gets an `api` service that runs the project from a mount: on every start it installs dependencies into its own volume, runs `db:migrate` and `db:seed`, then `start:dev`. `.env` keeps `localhost` URLs for tools on your machine; compose overrides them with the service names. The tests run on your machine either way.

### Examples

```sh
INSTALL=https://github.com/yhagus/create-nest-kit/releases/latest/download/install.sh

# Defaults: Fastify, PostgreSQL, Drizzle, hand-rolled JWT, Zod, service pattern, nested layout; npm
curl -fsSL $INSTALL | sh -s -- my-api --yes

# Express + Prisma + the official auth packages, CQRS in the flat layout, with pnpm
curl -fsSL $INSTALL | sh -s -- my-api --yes --platform express --orm prisma --auth nest --pattern cqrs --layout flat --pm pnpm

# MongoDB (Mongoose is implied), CSRF off by default
curl -fsSL $INSTALL | sh -s -- my-api --yes --db mongodb --no-csrf

# Show what would be generated, and write nothing
curl -fsSL $INSTALL | sh -s -- my-api --yes --dry-run
```

---

## Contributing

This repository is a pnpm workspace:

| Path                        | Contents                                                      |
| --------------------------- | ------------------------------------------------------------- |
| `packages/create-nest-kit/` | the CLI: engine in `src/`, templates in `templates/`          |
| `install.sh`                | the curl installer                                            |
| `scripts/`                  | the matrix, smoke tests, release packing and release notes    |
| `docs/layers.md`            | how layers, slots, manifests and relocation work              |
| `docs/contract.md`          | the HTTP contract every generated project serves              |
| `docs/adr/`, `GLOSSARY.md`  | the decisions behind the design, and the project's vocabulary |
| `docs/agents/releasing.md`  | how to cut a release                                          |
| `.github/workflows/`        | CI on every push to `main`, and the release                   |

```sh
pnpm install
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

### Layers and slots

A generated project is the union of a fixed sequence of **layers**: `base`, a layout, a platform, a database, a validation library, the pattern's `core`, the ORM's `core`, the ORM's `auth-<style>` stores, an auth style and the pattern's `auth-<style>` flows, plus `web/nuxt` in API + web projects. Each layer is a folder of template files copied verbatim, plus a TypeScript **manifest** with its dependencies, scripts, env vars, compose services and README sections. `package.json`, `.env`, `docker-compose.yml`, `README.md` and the CI workflow are rendered from the merged manifests.

Templates are written once, in the nested service layout; relocation maps each file to its place for the chosen pattern and layout and rewrites its imports. Code in one layer reaches another layer's variant code only through fixed file paths, the **slots** (for example `src/bootstrap/create-app.ts`, provided by the platform layer). Two layers providing the same file, a manifest conflict or an unfilled slot fails generation. [docs/layers.md](docs/layers.md) has the details; read it before changing templates.

### Adding a layer

1. Write the manifest in `packages/create-nest-kit/src/layers/<kind>/<name>.ts` with `status: 'planned'`, and add it to `LAYERS` in `src/layers/registry.ts` at its place in the order. A new option value (say, another ORM) also goes into the lists in `src/options.ts`, the labels in `src/labels.ts` and the help text in `src/help.ts`.
2. Put its files in `templates/<layer id>/`. Spell dotfiles with `_` (`_gitignore`), provide the slots the layer owns, and touch no other layer's files.
3. Iterate on a generated copy outside the repo (see "Working on templates" in `docs/layers.md`).
4. Set `status: 'ready'`. The wizard enables the combos whose layers are all ready, `test/layers/coverage.test.ts` starts composing them, and the matrix starts running them.
5. Run the matrix for the new combos, e.g. `pnpm matrix --only '*-prisma-*'`.

### The matrix

`pnpm matrix` builds the CLI, then for each combo generates a project outside the repo and runs `install`, `typecheck`, `build`, `lint`, `format:check` and `test` in it (Docker must be running). It prints a pass/fail table and keeps the logs and failed projects in `$MATRIX_DIR` (default: `<os tmpdir>/create-nest-kit-matrix`).

```sh
pnpm matrix --subset pr                  # 20 combos: every pair of option values at least once (pairwise)
pnpm matrix --only 'express-*-nest-*'    # glob on <platform>-<database>-<orm>-<auth>-<validation>-<pattern>-<layout>
pnpm matrix --only 'fastify-postgres-drizzle-jwt-zod-service-nested' --steps install,typecheck --keep
node scripts/matrix.ts --list --subset pr  # print the selected ids as JSON
```

CI runs the pairwise subset on every push to `main`, one job per combo. A release runs all 480 before it publishes ([ADR 0005](docs/adr/0005-pairwise-on-push-full-matrix-on-release.md)).

### Smoke tests

The matrix runs every step on the host. `scripts/smoke.ts` boots a generated project in Docker instead, then checks `/health` and signs in as the admin `db:seed` creates:

```sh
pnpm build
node scripts/smoke.ts image --orm prisma --pm npm   # the production image, against compose's services
node scripts/smoke.ts dev --type fullstack          # --dev-env docker's containers, web/ included
```

`SMOKE_PORT` changes the API's port (default 3000) and `SMOKE_DIR` where the project goes. CI runs six scenarios on every push to `main`; together the image ones cover every ORM and package manager.

### The installer

`pnpm build` bundles the CLI with esbuild into `dist/cli.js` (the Node.js version check) and `dist/run.js` (everything else, dependencies inlined), so the release archive runs with plain `node`. `pnpm pack:release` writes the release assets into `release/`.

```sh
pnpm test:installer   # build, pack, shellcheck, then install.sh in Docker (node:24, node:22, no Node, alpine, tampered archive)
NEST_KIT_DOWNLOAD_URL=file://$PWD/release sh install.sh ../nk-try --yes --no-install --no-git
```

`NEST_KIT_DOWNLOAD_URL` replaces the GitHub download URL; `file://` works with curl.

### Releasing

Releases are GitHub Releases, cut from a `vX.Y.Z` tag; nothing is published to npm. The steps and the release notes format are in [docs/agents/releasing.md](docs/agents/releasing.md), and every release's notes are in [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE)
