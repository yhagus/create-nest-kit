# v2.1.0 (2026-11-26)

#### Notable changes

**Upgrade**
* Generated projects are pinned to Node 26.13.1 (LTS): `.nvmrc`, the Dockerfile, the compose dev image, `engines` (`^26.13.1`) and `@types/node` (26.6.6). Regenerate, or update these by hand in an existing project. GitHub CI now reads `.nvmrc` – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* Node 26 no longer bundles corepack, so the Dockerfile, the CI and the compose dev container install `corepack@0.36.0` explicitly. Keep that step when updating a Generated project by hand – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* The installer itself still runs on Node >=24.15; only Generated projects need Node 26 – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* `--remote` together with `--no-git` is now rejected – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)

**CI provider**
* New CI provider Option: the Wizard always asks for it, preselected from the Remote host, and `--ci github|gitlab|none` sets it without the prompt (default `github`) – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* `gitlab` writes a `.gitlab-ci.yml` with a Node image, corepack and bun setup, a package store cached under `.ci-cache/`, merge request and `main` pipelines, and a web job for fullstack projects. It uses a `docker:dind` service for Testcontainers, so runners must be privileged – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* `none` writes no CI file – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)

**Git and Remote**
* `git init` now creates the `main` branch – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)
* New optional Remote prompt and `--remote <url>` Option register `origin`. The installer never pushes; the next steps show `git push -u origin main` – [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d)

#### Features
* `general`
  * [d7cb403](https://github.com/yhagus/create-nest-kit/commit/d7cb4037d32181d96505847883c1ed46f6df033d) feat: pin node 26 and add --remote and --ci github|gitlab|none

**Full Changelog**: https://github.com/yhagus/create-nest-kit/compare/v2.0.0...v2.1.0

# v2.0.0 (2026-11-20)

Generated projects keep only feature tests: every test drives the app from outside and runs against real services.

#### Notable changes

**Upgrade**
* **Breaking:** generated projects keep their tests in `tests/<feature>/<scenario>.test.ts` instead of `test/`. The `test:e2e` script and `vitest.config.e2e.ts` are gone; `test` runs everything and needs Docker – [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c)
* **Breaking:** generated projects no longer ship unit specs (`src/**/*.spec.ts`), in-memory fakes or per-ORM contract suites. Behaviour those covered is tested through the HTTP API, `db:migrate`, `db:seed` or booting the app where it can be reached from outside (ADR 0006) – [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c)
* Existing projects are not affected: a generated project has no dependency on create-nest-kit. To pin v1 for new projects, use `https://github.com/yhagus/create-nest-kit/releases/download/v1.0.0/install.sh`.

**Feature tests**
* Mail is checked through a real Mailpit container, read back over its HTTP API; the in-memory mail transport that only tests used is removed from `MailModule` – [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c)
* New scenarios cover what the removed unit tests used to: concurrent registration, refresh and role creation, `%` and `_` in user search, invalid env refusing to boot, `db:seed` creating and re-running, the 500 body hiding its message, and more – [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c)
* The global setup migrates the test database with the project's own `db:migrate` script – [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c)

**Installer**
* The installer's own tests run the built CLI from outside, including the wizard through a pseudo-terminal, and generate all 480 combos on every run – [26df3f6](https://github.com/yhagus/create-nest-kit/commit/26df3f6c8714c198d4a4dce4eaacbc041cd1b617)

**Docs**
* ADR 0006 records the feature-tests-only decision; ADR 0004 and the glossary follow it – [219e8fc](https://github.com/yhagus/create-nest-kit/commit/219e8fc328efe87c4a5ed69f29352a9d7f0bcfdd)

#### Features
* `templates`
  * [d425a5c](https://github.com/yhagus/create-nest-kit/commit/d425a5c0e63b095a6eac8531875f290dd6ba929c) feat(templates): keep only feature tests in generated projects (**breaking**)

#### Bug fixes
* `templates`
  * [5cc3a65](https://github.com/yhagus/create-nest-kit/commit/5cc3a6567755ecb1229da1df12b84c826a054410) fix(templates): widen the timing margins of the token lifetime tests
  * [207f168](https://github.com/yhagus/create-nest-kit/commit/207f16869b03290eb5d3cb0a9ec7a3ed8d4bc266) fix(templates): stop checking a renewed one-second access token
  * [42e84d9](https://github.com/yhagus/create-nest-kit/commit/42e84d9db95d1bfe2e9a7b88a5696eb1754ff1a1) fix(templates): accept reuse detection in the concurrent refresh test

#### Docs
* `adr`
  * [219e8fc](https://github.com/yhagus/create-nest-kit/commit/219e8fc328efe87c4a5ed69f29352a9d7f0bcfdd) docs(adr): keep only feature tests in the installer and generated projects

#### Tests
* `installer`
  * [26df3f6](https://github.com/yhagus/create-nest-kit/commit/26df3f6c8714c198d4a4dce4eaacbc041cd1b617) test(installer): replace unit tests with feature tests in tests/

**Full Changelog**: https://github.com/yhagus/create-nest-kit/compare/v1.0.0...v2.0.0

# v1.0.0 (2026-11-20)

The first stable release. The wizard's options, the HTTP contract every combo serves and the layout of generated projects are now stable: a breaking change to any of them means a new major version.

#### Notable changes

**Upgrade**
* Nothing to do for existing projects: a generated project has no dependency on create-nest-kit. A project generated with the defaults (`--pattern service --layout nested`) differs from v0.2.0 only by a "Folder layout" row in its README and one line in its e2e Swagger helper, which now writes its temporary file inside the project – [37306b5](https://github.com/yhagus/create-nest-kit/commit/37306b514d2cc5678905fd1f95d6ab8afd1ed8c8)
* Install from the release instead of the `main` branch: `curl -fsSL https://github.com/yhagus/create-nest-kit/releases/latest/download/install.sh | sh`. The old `raw.githubusercontent.com/.../main/install.sh` URL keeps working – [b19546d](https://github.com/yhagus/create-nest-kit/commit/b19546d1ac02ca6e014e6473a71d89889d2d9017), [c5a1335](https://github.com/yhagus/create-nest-kit/commit/c5a13353860150f98519af1adea7e5c6011496c5)
* **Breaking (contributors):** combo ids end in `-nested` or `-flat`, so `pnpm matrix --only` globs written for v0.2.0 need the extra segment – [37306b5](https://github.com/yhagus/create-nest-kit/commit/37306b514d2cc5678905fd1f95d6ab8afd1ed8c8)

**Pattern**
* With `--pattern cqrs`, each feature module keeps only its module and controllers at its root. Everything else moves into role folders, as in the official `@nestjs/cqrs` example: `commands/{handlers,impl}`, `queries/{handlers,impl}`, `models`, `providers`, `schemas`, `guards` and `decorators`, with a `handlers/index.ts` listing each module's handlers – [37306b5](https://github.com/yhagus/create-nest-kit/commit/37306b514d2cc5678905fd1f95d6ab8afd1ed8c8)

**Layout**
* A new option, `--layout nested|flat` (also asked by the wizard). Flat puts each module directly under `src/`, moves shared code to `src/libs/` and writes imports that leave a module with the `@/` alias, which `nest build` rewrites in `dist/`. It works with both patterns, so there are now 480 combos – [37306b5](https://github.com/yhagus/create-nest-kit/commit/37306b514d2cc5678905fd1f95d6ab8afd1ed8c8)

**Installer**
* Each release carries its own `install.sh`, which installs that release by default: `releases/download/v1.0.0/install.sh` always installs v1.0.0. `NEST_KIT_VERSION` still overrides it – [b19546d](https://github.com/yhagus/create-nest-kit/commit/b19546d1ac02ca6e014e6473a71d89889d2d9017)

**Releases**
* A release now generates all 480 combos and runs their checks before it publishes; pushes to `main` keep running the 20-combo pairwise subset – [8c88365](https://github.com/yhagus/create-nest-kit/commit/8c88365a47ff961d765f0aa4948a91ff23f7cc3c)
* Release notes come from this file, grouped by feature area and then by commit type and scope – [fdb9b08](https://github.com/yhagus/create-nest-kit/commit/fdb9b080a410a9e2bd186a2db6238dc222b88854), [eec8619](https://github.com/yhagus/create-nest-kit/commit/eec86195d36ad08ef34f8e387d16ddc0410f12fb)

**Docs**
* A glossary (`GLOSSARY.md`) and five ADRs record the project's vocabulary and the decisions behind its design; the README is restyled – [953996f](https://github.com/yhagus/create-nest-kit/commit/953996f9199348f64886be8d28eb2e97a36d1f53), [c5a1335](https://github.com/yhagus/create-nest-kit/commit/c5a13353860150f98519af1adea7e5c6011496c5)

#### Features
* `general`
  * [37306b5](https://github.com/yhagus/create-nest-kit/commit/37306b514d2cc5678905fd1f95d6ab8afd1ed8c8) feat: add cqrs role folders and a flat layout choice
* `installer`
  * [b19546d](https://github.com/yhagus/create-nest-kit/commit/b19546d1ac02ca6e014e6473a71d89889d2d9017) feat(installer): publish install.sh with each release, pinned to its version

#### Docs
* `agents`
  * [d71cb2d](https://github.com/yhagus/create-nest-kit/commit/d71cb2d9236e3759d1cd3246c00493c6653e03e9) docs(agents): document the release steps and changelog format
* `general`
  * [cab5388](https://github.com/yhagus/create-nest-kit/commit/cab5388391ee070ccd28b0e375bf9ad7ff852ed8) docs: add claude.md and agents.md pointers
  * [953996f](https://github.com/yhagus/create-nest-kit/commit/953996f9199348f64886be8d28eb2e97a36d1f53) docs: add glossary, adrs and agent skills config
* `readme`
  * [c5a1335](https://github.com/yhagus/create-nest-kit/commit/c5a13353860150f98519af1adea7e5c6011496c5) docs(readme): restyle and install from the latest release

#### Tests
* `installer`
  * [9901ecf](https://github.com/yhagus/create-nest-kit/commit/9901ecf3591023973a8008f79e0319ea28cce008) test(installer): expect the layout layer in the dry-run plan

#### Build and CI
* `general`
  * [8c88365](https://github.com/yhagus/create-nest-kit/commit/8c88365a47ff961d765f0aa4948a91ff23f7cc3c) ci: run the full matrix before a release
* `release`
  * [fdb9b08](https://github.com/yhagus/create-nest-kit/commit/fdb9b080a410a9e2bd186a2db6238dc222b88854) ci(release): check the changelog and publish its section as the release notes

#### Chores
* `scripts`
  * [14c66a6](https://github.com/yhagus/create-nest-kit/commit/14c66a6579e1a0d817c0b92ee853eddc33065983) chore(scripts): sort release note scopes without mutating the list
  * [eec8619](https://github.com/yhagus/create-nest-kit/commit/eec86195d36ad08ef34f8e387d16ddc0410f12fb) chore(scripts): generate release notes grouped by type and scope

**Full Changelog**: https://github.com/yhagus/create-nest-kit/compare/v0.2.0...v1.0.0
