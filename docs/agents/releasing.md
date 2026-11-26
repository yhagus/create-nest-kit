# Releasing

A release is a `chore(release): vX.Y.Z` commit on `main` and a pushed `vX.Y.Z` tag. The tag starts `.github/workflows/release.yml`, which checks the tag against the package version and `CHANGELOG.md`, runs the full matrix (every combo, ADR 0005), packs the CLI and creates the GitHub Release. The CHANGELOG section of that version, without its heading, becomes the release text, so write the section as the release page should read.

The full matrix runs one CI job per combo, so a release takes a while. A tag that doesn't match the package version, or has no CHANGELOG section, fails in the first minute, before the matrix starts.

The release carries `create-nest-kit.tar.gz`, its `.sha256` and `install.sh`. The attached `install.sh` installs its own release by default (`NEST_KIT_VERSION` still overrides it); the copy in the repo installs the latest release. Nothing goes to npm.

## Steps

1. Pick the version from the Conventional Commits since the last tag (`git describe --tags --abbrev=0`): a `BREAKING CHANGE` footer or `!` means major, any `feat` means minor, otherwise patch. A version with a suffix (`v1.2.0-rc.1`) is published as a prerelease.
2. Set `version` in `packages/create-nest-kit/package.json`.
3. Add the section at the top of `CHANGELOG.md` in the format below.
4. Bump the pinned Node version to the latest Node LTS patch: `PINNED_NODE_VERSION` in `packages/create-nest-kit/src/generate/pinned-node-version.ts`, the literals in `templates/base/_nvmrc` and `templates/base/Dockerfile`, and `@types/node` in `src/layers/base.ts` (same major). Bump corepack to its latest release too: `COREPACK_VERSION` in `src/generate/render-compose.ts` and the literal in `templates/base/Dockerfile`.
5. Run `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, commit `chore(release): vX.Y.Z`, and push `main`.
6. Tag and push: `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`. Watch the run with `gh run watch`. Done when the Release workflow is green and the release page shows the section.

## Section format

Modelled on the NestJS release notes (https://github.com/nestjs/nest/releases): changes grouped by feature area, every change linked to its commit.

```markdown
# vX.Y.Z (YYYY-MM-DD)

#### Notable changes

**Upgrade**

- What someone regenerating a project, or updating a generated project by hand, must know: changed files or dependencies in generated projects, removed or renamed options (prefixed **Breaking:**), a new minimum Node.js version – [abc1234](https://github.com/yhagus/create-nest-kit/commit/<full hash>)

**<Feature area>**

- One line per user-visible change, ending in the commits that made it – [abc1234](…), [def5678](…)

<output of: node scripts/release-notes.ts <previous tag> vX.Y.Z>
```

- **Notable changes** is hand-written prose for people running the installer and maintaining generated projects. Keep **Upgrade** first and present in every release; give it a "Nothing to do" bullet when nothing applies. Group the rest by feature area, using `GLOSSARY.md` terms (Wizard, Layer, Option, Combo, Pattern, Layout, HTTP contract, …).
- The commit lists below it come from `node scripts/release-notes.ts <previous tag> vX.Y.Z`: commits since the previous tag grouped by type (Features, Bug fixes, Refactors, Docs, …), then by scope (commits without one go under `general`), each with its linked short id, ending in the **Full Changelog** compare link. Paste its output unedited; fix a wrong scope or type in future commits, not in the notes.
- Run the script before the release commit exists, with `HEAD` as the default ref. It skips merges and `chore(release)` commits.
