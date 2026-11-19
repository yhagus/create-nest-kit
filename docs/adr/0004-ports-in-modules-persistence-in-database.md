# Feature modules own ports; persistence lives in `src/database/`

A feature module depends only on its ports, never on an ORM. Each ORM's repositories, schemas and migrations live in `src/database/`, provided by the `persistence/<orm>` layers. This is what lets five ORMs plug into the same modules. Each repository is proven by the same feature tests, run in every combo that uses its ORM (ADR 0006).

## Consequences

- `src/database/` is deliberately left out of role folders and the flat layout: it is one folder per project, shared by every ORM layer, not a feature module.
