# Feature tests only, in the installer and in generated projects

Both the installer and every generated project used to mix unit specs (calling functions, handlers and services directly, often against in-memory fakes) with tests that drove the program from outside. The unit specs pinned internal signatures, so refactors broke them while behaviour stayed the same, and many only restated the code they tested. We keep only feature tests, as routerlm-oss does (its ADR 0009).

A feature test drives the program from outside and asserts what can be observed:

- **Generated projects:** an HTTP request, a CLI command (`db:migrate`, `db:seed`) or booting the app; asserting the response, the rows in the database or the mail Mailpit caught. They run against real databases and Redis through Testcontainers, with one `test` script.
- **Installer:** running the built CLI (and `install.sh`) in a temporary folder, through a pseudo-terminal for the wizard; asserting the exit code, the output and the files written.

Tests live in `tests/<feature>/<scenario>.test.ts`, with shared helpers in `tests/support/`.

## Consequences

- A case that cannot be reached from outside is either dead code or needs a real entry point; it is not tested through a private seam.
- Each repository is proven by the feature tests of the combos that use its ORM, not by a separate contract suite (ADR 0004).
- Generated projects' tests need Docker.
