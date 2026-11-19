# Every combo serves the same HTTP contract

Platform, database, ORM, auth style, validation library, pattern and layout must not change what clients see: the endpoints, status codes and payloads in `docs/contract.md` are identical in every generated project. This is the installer's promise (changing a stack choice never breaks a client), and it is what makes 480 combos testable: one end-to-end suite in the `base` layer runs unchanged in every generated project.
