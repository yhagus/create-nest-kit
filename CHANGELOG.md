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
