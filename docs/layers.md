# Layers, slots and manifests

A generated project is the union of a fixed sequence of **layers**. Each layer is a folder of
template files plus a TypeScript **manifest**. Everything below lives in
`packages/create-nest-kit/`.

## Layers

| Layer id                        | Included when                    | Manifest                                      |
| ------------------------------- | -------------------------------- | --------------------------------------------- |
| `base`                          | always                           | `src/layers/base.ts`                          |
| `platform/<fastify\|express>`   | `options.platform`               | `src/layers/platform/<name>.ts`               |
| `database/<postgres\|mongodb>`  | `options.database`               | `src/layers/database/<name>.ts`               |
| `validation/<library>`          | `options.validation`             | `src/layers/validation/<library>.ts`          |
| `persistence/<orm>/core`        | `options.orm`                    | `src/layers/persistence/<orm>/core.ts`        |
| `persistence/<orm>/auth-<auth>` | `options.orm` and `options.auth` | `src/layers/persistence/<orm>/auth-<auth>.ts` |
| `auth/<jwt\|nest>`              | `options.auth`                   | `src/layers/auth/<name>.ts`                   |

`<orm>` is one of `drizzle`, `prisma`, `typeorm`, `mikroorm`, `mongoose`. `<library>` is one of
`zod`, `class-validator`, `valibot`, `arktype`.

- **Order is fixed** (the order of `LAYERS` in `src/layers/registry.ts`). Every project resolves
  exactly seven layers, in the order of the table.
- **Template folder:** `templates/<layer id>/`, e.g. `templates/persistence/drizzle/auth-jwt/`.
  A layer without a folder contributes no files.
- **Where migrations live depends on the ORM's history format:**
  - ORMs with a single history per project (a journal or lock file) ship **one complete initial migration in `persistence/<orm>/auth-<auth>`**, because the two auth styles need different tables. Drizzle and Prisma work this way.
  - ORMs whose migrations are independent classes put **each layer's own migration in that layer**: core's migration in `core`, the auth tables' migration in `auth-<auth>`, with a later timestamp. TypeORM and MikroORM work this way.
- **Edit only your own layer's files.** Every manifest file already exists and is registered, so
  adding content never touches a shared file. Shared version pins go in `base.ts`.

## Template files

- Files are copied **verbatim**. There is no template language: `{{name}}`, `<%= %>` and `${}`
  are left as they are. Anything that depends on options goes into the manifest (env values,
  scripts, README text). Code reads options at runtime from env vars, e.g. `CSRF_ENABLED`.
- **Dotfiles:** a path segment starting with `_` becomes `.` in the project:
  `_gitignore` → `.gitignore`, `_github/workflows/x.yml` → `.github/workflows/x.yml`.
  Real dotfiles inside `templates/` are ignored. Two underscores keep one literal underscore:
  `drizzle/meta/__journal.json` → `drizzle/meta/_journal.json`.
- **No collisions:** each project path may come from one layer only. Layers never override each
  other's files; the composer fails and names both layers. Templates also may not provide the
  rendered files listed below.
- Templates are not type-checked or linted by the installer. The matrix checks them inside each
  generated project.
- Templates and rendered files must pass the project's `format:check` (`templates/base/_prettierrc`
  and `_prettierignore`); `test/generate/formatting.test.ts` checks them in `pnpm test`. The root
  `.prettierrc` is kept identical, so the repo's `pnpm format` and editors format templates
  correctly. Files written by ORM tooling (migrations, Prisma's client) are ignored in both.

## Slots

Code in one layer imports another layer's variant code only through fixed paths, the **slots**
(`src/slots.ts`). Every project must contain each slot, provided by exactly one of its layers:

| Slot                                      | Provided by                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `src/bootstrap/create-app.ts`             | `platform/*`                                                                |
| `src/config/database.env.ts`              | `database/*`                                                                |
| `src/common/validation.ts`                | `validation/*`                                                              |
| `src/config/env.schema.ts`                | `validation/*`                                                              |
| `src/auth/auth.dto.ts`                    | `validation/*`                                                              |
| `src/modules/users/users.dto.ts`          | `validation/*`                                                              |
| `src/modules/roles/roles.dto.ts`          | `validation/*`                                                              |
| `src/database/database.module.ts`         | `persistence/<orm>/core`                                                    |
| `src/database/database.health.ts`         | `persistence/<orm>/core`                                                    |
| `src/auth/auth.module.ts`                 | `auth/*`                                                                    |
| `src/auth/decorators.ts`                  | `auth/*`                                                                    |
| `src/database/auth-persistence.module.ts` | `persistence/<orm>/auth-<auth>` (imported by that style's `auth.module.ts`) |
| `test/support/database.global-setup.ts`   | `database/*` or `persistence/*/core`                                        |
| `test/support/reset-database.ts`          | `database/*` or `persistence/*/core`                                        |

When code starts importing a variant file from another layer, add its path to `REQUIRED_SLOTS`.

What each validation layer's slots export, with the same names in every library:

| Slot                             | Exports                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/common/validation.ts`       | `createValidationPipe()` (the global pipe, throwing VALIDATION_FAILED with `FieldError[]` details from `src/common/field-error.ts`), `ValidBody(dto)` and `ValidQuery(dto)` parameter decorators |
| `src/config/env.schema.ts`       | `parseBaseEnv(source): EnvParseResult<BaseEnv>` (`src/config/env-contract.ts`)                                                                                                                   |
| `src/auth/auth.dto.ts`           | `RegisterDto`, `LoginDto`, `RefreshDto`, `UpdateProfileDto`, `ChangePasswordDto`, `ForgotPasswordDto`, `ResendVerificationDto`, `VerifyEmailDto`, `ResetPasswordDto`                             |
| `src/modules/users/users.dto.ts` | `CreateUserDto`, `UpdateUserDto`, `ListUsersQuery`                                                                                                                                               |
| `src/modules/roles/roles.dto.ts` | `CreateRoleDto`, `UpdateRoleDto`                                                                                                                                                                 |

Each DTO name is both a value (passed to `ValidBody`/`ValidQuery`) and a type (the handler's parameter): a
class, or a schema plus its inferred type under the same name. Response views (`*.view.ts`) are plain classes in
`base`. Limits shared by every library (`EMAIL_MAX_LENGTH`, `ROLE_NAME_PATTERN`, `MAX_PAGE_SIZE`, …) live next to
the domain types in `base`, so the libraries can't drift apart; `src/config/env.spec.ts` and the e2e suite run
unchanged against every library.

The auth flows behind `/auth` are the `AuthService` port in base (`src/auth/auth.service.ts`); each
`auth/*` layer binds its implementation in its `auth.module.ts`, so that file is the only entry point.

## Manifest

Types are in `src/layers/types.ts`:

```ts
interface LayerManifest {
  id: string; // also the template folder
  status: 'ready' | 'planned';
  when(options: ProjectOptions): boolean;
  dependencies?: Record<string, string>; // exact versions only: '8.23.1', never '^8.23.1'
  devDependencies?: Record<string, string>; // exact versions only
  scripts?: Record<string, string>;
  packageJson?: Record<string, unknown>; // extra top-level package.json fields
  env?: EnvVar[];
  compose?: { services?: Record<string, unknown>; volumes?: string[] };
  readme?: { title: string; body: string | ((options) => string) }[];
}

interface EnvVar {
  key: string;
  value: string | ((options) => string);
  comment?: string;
  secret?: boolean;
}
```

- `env`: written to `.env` and `.env.example`, grouped under a `# --- <layer id> ---` header in
  layer order. With `secret: true`, `.env` gets a random 48-byte base64url value and
  `.env.example` gets `value` as a placeholder. Use a function `value` for option-dependent
  defaults, e.g. `value: (o) => String(o.csrf)` for `CSRF_ENABLED`.
- `packageJson`: deep-merged across layers; arrays are unioned (e.g. `pnpm.onlyBuiltDependencies`).
  `name`, `version`, `private`, `type`, `engines`, `packageManager`, `scripts`, `dependencies` and `devDependencies`
  are owned by the renderer and rejected here.
- `compose.services` are docker-compose service definitions keyed by name. `compose.volumes` lists
  named volumes.
- Use the same script names across variants: `db:migrate`, `db:migration:create`, `db:seed`,
  plus `start:dev`, `lint`, `format:check`, `typecheck`, `test`, `test:e2e`. CI and the matrix rely on
  the last five.

### Merge rules

The resolved layers' manifests are merged in layer order. The same key from two layers is
allowed only when both declarations are identical; anything else fails the generation and names
both layers:

- the same dependency at two versions;
- the same script, env var (value, comment and `secret` flag) or compose service, declared differently;
- the same `packageJson` leaf with two values.

An env var repeated identically stays in the group of the first layer that declares it.

## Rendered files

These are computed from the merged manifest by `src/generate/render-*.ts`, never copied from
templates. Their output is sorted and deterministic.

| File                       | Built from                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`             | name, version `0.0.1`, `type: module`, engines, `packageManager` (pnpm and yarn only), sorted scripts and deps, `packageJson` extras |
| `.env`, `.env.example`     | `env`                                                                                                                                |
| `docker-compose.yml`       | `compose`                                                                                                                            |
| `README.md`                | options table, quickstart and scripts table in the chosen package manager's syntax, `readme` sections                                |
| `.github/workflows/ci.yml` | Node 24, package manager setup, install, `lint`, `format:check`, `typecheck`, `test`, `test:e2e`                                     |

`packageManager` pins the version of pnpm or yarn that ran the installer (read from
`npm_config_user_agent`) or, when the wizard asked for the package manager, the version its
`--version` printed; otherwise the tested default in `src/package-manager.ts`. The wizard asks only
when neither `--pm` nor the user agent names one (as under `install.sh`), offering the installed
managers (`src/package-manager-choice.ts`); `--yes` uses npm then. Corepack in the Dockerfile and `pnpm/action-setup` in CI read it; npm and bun get no pin,
since corepack doesn't manage them.

## Status: `planned` and `ready`

Every layer starts as `planned`. Set `status: 'ready'` when the layer's templates and manifest are
complete. A combo is available only when all seven of its layers are `ready`:

- the wizard shows unavailable choices disabled ("coming soon");
- the CLI refuses a combo with planned layers, naming them;
- `scripts/matrix.ts` and the coverage test skip it.

`test/layers/coverage.test.ts` composes every combo whose layers are all ready and fails on any
collision, unfilled slot or manifest conflict. It passes vacuously until layers become ready, then
covers each new combo automatically. `test/layers/registry.test.ts` checks that every dependency
in every manifest is pinned exactly.

## Working on templates

Generate a plain copy of a combo outside this repo, check it there, and generate it again after
each template or manifest edit. Inside the repo, pnpm treats the project as part of the workspace
and oxlint skips it because of the root `.gitignore`.

```sh
pnpm build
node packages/create-nest-kit/dist/cli.js ../nest-kit-playground/api --yes --no-git --force --pm pnpm \
  --platform express --orm prisma --auth nest
cd ../nest-kit-playground/api && pnpm typecheck && pnpm lint && pnpm test
```

`--force` writes over the files of the previous run; files a template no longer provides stay, so
delete the folder when you remove or rename a template file. Copies are deliberate: symlinked
template files break module resolution across layers and swc's decorator compilation. To run the
whole check for one or more combos, use the matrix (below) with `--only` and `--keep`.

## Installer tests

`pnpm build` bundles `src/cli.ts` (the Node.js version check) and `src/run.ts` with esbuild
(`scripts/build.ts`) into `dist/cli.js` and `dist/run.js`, inlining every dependency. Both stay in
`dist/`, so `src/paths.ts` finds `../templates/` and `../package.json` as before. `tsc` only
type-checks.

Engine tests use the fixture layers in `test/fixtures/layers.ts` (templates in
`test/fixtures/templates/`), not the real ones. The built CLI can be pointed at another layer set
with the test-only env var `NEST_KIT_LAYER_SET_MODULE=<path to a module exporting layerSet>`;
`test/cli.test.ts` uses it to run `dist/cli.js` end to end.

## Matrix

`pnpm matrix` builds the CLI, then for each selected combo generates `<matrix dir>/<id>` with
`--pm pnpm --no-git --no-install --yes --force` and runs `pnpm install`, `typecheck`, `build`, `lint`,
`format:check`, `test` and `test:e2e` in it (Docker is needed for the tests). It prints a summary table and exits
non-zero on any failure. The matrix dir is `$MATRIX_DIR`, defaulting to `<os tmpdir>/create-nest-kit-matrix`
(outside the repo, for the same reasons as the playground). Output goes to `<matrix dir>/<id>.log`; passing projects are deleted unless
`--keep` is given.

| Flag               | Effect                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `--only <glob>`    | Combos whose id matches, e.g. `--only 'fastify-*-jwt-*'`. Ids are `<platform>-<database>-<orm>-<auth>-<validation>`. |
| `--subset pr\|all` | `pr`: 20 combos covering every pair of values of any two choices (pairwise). `all` (default): all 80.                |
| `--steps <list>`   | Comma-separated subset of `install,typecheck,build,lint,format:check,test,test:e2e`.                                 |
| `--keep`           | Keep passing projects too.                                                                                           |
| `--list`           | Print the ids of the selected, ready combos as a JSON array and run nothing (CI builds its matrix from it).          |

The selection logic lives in `src/matrix/select.ts`; combos come from `listCombos()` and
`prSubset()` in `src/options.ts`.
