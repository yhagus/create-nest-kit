# create-nest-kit

A wizard that generates a ready-to-run NestJS 12 API. You pick the HTTP platform, the database and
ORM, the auth style and the validation library; every combination generates the same modules and serves the same HTTP
contract, only the code behind it differs.

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh
```

See [Install](#install) for passing options, pinning a version and reading the script first. It is
not published to npm yet, so `npm create nest-kit` does not work.

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

## What you get

- **Auth:** register, login, refresh-token rotation with reuse detection, logout, profile; email
  verification (toggle); forgot, reset and change password.
- **Authorization:** roles plus permissions declared as a TypeScript enum, with deny-by-default
  access decorators (`@Public()`, `@Authenticated()`, `@RequirePermissions(...)`).
- **Users, roles and sessions:** list your sessions, revoke one or all others; revoked access
  tokens stop working immediately.
- **Security:** CSRF protection (toggle), security headers, CORS, Redis-backed rate limiting.
- **Infrastructure:** BullMQ queues, mail through a queue (Mailpit in development), pino logging
  with request ids, health checks at `/health`, Swagger UI at `/docs`, an env schema validated at startup.
- **Tests:** unit tests against in-memory fakes, repository contract tests, and an e2e suite that
  runs against real Postgres or MongoDB and Redis (Testcontainers).
- **Tooling:** TypeScript 6, Vitest, oxlint, prettier, `docker-compose.yml`, a `Dockerfile` and a
  GitHub Actions CI workflow.

The routes, payloads, status codes and error codes are specified in
[docs/contract.md](docs/contract.md). The e2e suite in every generated project is its executable
form.

## Install

The installer checks the requirements, downloads the CLI from the
[latest GitHub Release](https://github.com/yhagus/create-nest-kit/releases/latest), verifies its
SHA-256 checksum and starts the wizard:

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh
```

Arguments after `sh -s --` go to the CLI (see [Wizard options](#wizard-options) and
[Where your project goes](#where-your-project-goes)):

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh -s -- my-api --orm prisma
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | sh -s -- my-api --yes
```

Pin a release with `NEST_KIT_VERSION` (a tag from the
[releases page](https://github.com/yhagus/create-nest-kit/releases)):

```sh
curl -fsSL https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh | NEST_KIT_VERSION=v0.1.0 sh
```

To read the script before running it:

```sh
curl -fsSLO https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh
less install.sh
sh install.sh my-api
```

The wizard reads its answers from the terminal even when the script comes through a pipe. Where
there is no terminal (CI, containers), pass `--yes`.

### Requirements

- Node.js ≥ 24.15. The installer stops with a hint when it is missing or older; install it from
  [nodejs.org](https://nodejs.org) or with `fnm install 24` / `nvm install 24`.
- `curl` or `wget`, `tar`, and one of `sha256sum`, `shasum` or `openssl` (all present on macOS and
  most Linux distributions).
- To install the generated project's dependencies: npm, pnpm, yarn or bun.
- Docker only to run the generated project (`docker compose up`, `test:e2e`). git is optional; without
  it the CLI skips `git init`.

**Windows:** run the installer inside [WSL](https://learn.microsoft.com/windows/wsl/install). There
is no PowerShell installer yet.

## Wizard options

Any option given as a flag is not asked for. With `--yes`, everything not given takes its default.

| Option             | Choices (default first)                                                                            | Flag                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Project folder     | `nest-api`, created in the current folder; `.` uses the current folder itself                      | positional `[dir]`                                    |
| Package name       | the folder's name; asked when that isn't a valid npm package name                                  | `--name <package-name>`                               |
| HTTP platform      | Fastify · Express                                                                                  | `--platform fastify\|express`                         |
| Database           | PostgreSQL · MongoDB                                                                               | `--db postgres\|mongodb`                              |
| ORM / ODM          | PostgreSQL: Drizzle · Prisma 7 · TypeORM · MikroORM. MongoDB: Mongoose                             | `--orm drizzle\|prisma\|typeorm\|mikroorm\|mongoose`  |
| Auth style         | Hand-rolled `@nestjs/jwt` + argon2id · official `@nestjs/authentication` + `@nestjs/authorization` | `--auth jwt\|nest`                                    |
| Validation library | Zod · class-validator · Valibot · ArkType                                                          | `--validation zod\|class-validator\|valibot\|arktype` |
| Email verification | on · off                                                                                           | `--[no-]email-verification`                           |
| CSRF protection    | on · off                                                                                           | `--[no-]csrf`                                         |
| Package manager    | `--pm`, else asked among the installed ones (pnpm first); npm with `--yes`                         | `--pm pnpm\|npm\|yarn\|bun`                           |
| Install            | yes · no                                                                                           | `--no-install`                                        |
| Git repository     | yes · no (skipped inside an existing repository)                                                   | `--no-git`                                            |

**Compatibility:** MongoDB works only with Mongoose, so the wizard picks it without asking; the four
SQL ORMs work only with PostgreSQL. A flag combination that breaks this rule fails before anything
is written, with a hint (`--orm drizzle is not available for MongoDB; use --orm mongoose or --db postgres`).

Email verification and CSRF only set defaults in `.env` (`EMAIL_VERIFICATION_ENABLED`,
`CSRF_ENABLED`); the code for both is always generated.

### Non-interactive use

```sh
INSTALL=https://raw.githubusercontent.com/yhagus/create-nest-kit/main/install.sh

# Defaults: Fastify, PostgreSQL, Drizzle, hand-rolled JWT, Zod; installs with npm
curl -fsSL $INSTALL | sh -s -- my-api --yes

# Express + Prisma + the official auth packages, with pnpm, no git
curl -fsSL $INSTALL | sh -s -- my-api --yes --platform express --orm prisma --auth nest --pm pnpm --no-git

# MongoDB (Mongoose is implied), CSRF off by default
curl -fsSL $INSTALL | sh -s -- my-api --yes --db mongodb --no-csrf

# Show what would be generated, and write nothing
curl -fsSL $INSTALL | sh -s -- my-api --yes --dry-run
```

Other flags: `--force` writes into a non-empty directory without asking (files with the same name
are replaced, nothing is deleted), `-h, --help`, `-v, --version`.

## Contributing

This repository is a pnpm workspace:

| Path                        | Contents                                                   |
| --------------------------- | ---------------------------------------------------------- |
| `packages/create-nest-kit/` | the CLI: engine in `src/`, templates in `templates/`       |
| `install.sh`                | the curl installer                                         |
| `scripts/matrix.ts`         | generates combos and runs their checks                     |
| `scripts/pack-release.ts`   | packs the release archive and its checksum into `release/` |
| `docs/layers.md`            | how layers, slots and manifests work                       |
| `docs/contract.md`          | the HTTP contract every generated project serves           |
| `.github/workflows/`        | CI, the nightly matrix and the release                     |

```sh
pnpm install
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

### Layers and slots

A generated project is the union of seven **layers**, always in this order: `base`, a platform, a
database, a validation library, the ORM's `core`, the ORM's `auth-<style>` stores, and an auth style. Each layer is a
folder of template files copied verbatim, plus a TypeScript **manifest** with its dependencies,
scripts, env vars, compose services and README sections. `package.json`, `.env`, `docker-compose.yml`,
`README.md` and the CI workflow are rendered from the merged manifests.

Code in one layer reaches another layer's variant code only through fixed file paths, the
**slots** (for example `src/bootstrap/create-app.ts`, provided by the platform layer). Two layers
providing the same file, a manifest conflict or an unfilled slot fails generation.
[docs/layers.md](docs/layers.md) has the details; read it before changing templates.

### Adding a layer

1. Write the manifest in `packages/create-nest-kit/src/layers/<kind>/<name>.ts` with
   `status: 'planned'`, and add it to `LAYERS` in `src/layers/registry.ts` at its place in the order.
   A new choice (say, another ORM) also goes into the lists in `src/options.ts`, the labels in
   `src/labels.ts` and the help text in `src/help.ts`.
2. Put its files in `templates/<layer id>/`. Spell dotfiles with `_` (`_gitignore`), provide the
   slots the layer owns, and touch no other layer's files.
3. Iterate on a generated copy outside the repo (see "Working on templates" in `docs/layers.md`).
4. Set `status: 'ready'`. The wizard enables the combos whose seven layers are all ready,
   `test/layers/coverage.test.ts` starts composing them, and the matrix starts running them.
5. Run the matrix for the new combos, e.g. `pnpm matrix --only '*-prisma-*'`.

### The matrix

`pnpm matrix` builds the CLI, then for each combo generates a project outside the repo and runs
`pnpm install`, `typecheck`, `build`, `lint`, `format:check`, `test` and `test:e2e` in it (Docker must be running). It
prints a pass/fail table and keeps the logs and failed projects in `$MATRIX_DIR` (default:
`<os tmpdir>/create-nest-kit-matrix`).

```sh
pnpm matrix --subset pr                  # 20 combos: every pair of choices at least once (pairwise)
pnpm matrix --only 'express-*-nest-*'    # glob on <platform>-<database>-<orm>-<auth>-<validation>
pnpm matrix --only 'fastify-postgres-drizzle-jwt-zod' --steps install,typecheck --keep
node scripts/matrix.ts --list --subset pr  # print the selected ids as JSON
```

CI runs the PR subset on every push and pull request, one job per combo; the nightly workflow runs
all 80 and uploads the logs of failed combos as artifacts.

### The installer

`pnpm build` bundles the CLI with esbuild into `dist/cli.js` (the Node.js version check) and
`dist/run.js` (everything else, dependencies inlined), so the release archive runs with plain
`node`. `pnpm pack:release` writes `release/create-nest-kit.tar.gz` and its `.sha256`.

```sh
pnpm test:installer   # build, pack, shellcheck, then install.sh in Docker (node:24, node:22, no Node, alpine, tampered archive)
NEST_KIT_DOWNLOAD_URL=file://$PWD/release sh install.sh ../nk-try --yes --no-install --no-git
```

`NEST_KIT_DOWNLOAD_URL` replaces the GitHub download URL; `file://` works with curl.

### Releasing

Releases are GitHub Releases; nothing is published to npm (the package is `private`).

1. Bump `version` in `packages/create-nest-kit/package.json` and merge it to `main`.
2. Tag that commit and push the tag:

   ```sh
   git tag v0.2.0 && git push origin v0.2.0
   ```

3. The release workflow builds, lints, type-checks and tests, checks the tag equals the package
   version, packs the archive, smoke-tests `install.sh` against it, and creates the GitHub Release
   with generated notes and the two assets. The installer's default URL
   (`releases/latest/download/`) then serves the new version.

## License

[MIT](LICENSE)
