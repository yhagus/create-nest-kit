## Agent skills

### Issue tracker

Issues live in GitHub Issues on yhagus/create-nest-kit (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Layers and templates

How layers compose, and how template paths map to project paths (relocation, `@/` imports): `docs/layers.md`. Read it before adding or moving a template file.

## Checks

- Fast: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm -r test`
- Generated projects: `pnpm matrix --only '<combo id>'` (ids are `platform-database-orm-auth-validation-pattern-layout`; needs Docker for the generated project's `test`)

## Releasing

How to cut a release (version, CHANGELOG section, tag): `docs/agents/releasing.md`.
