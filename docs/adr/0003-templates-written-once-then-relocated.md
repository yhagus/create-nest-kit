# Templates are written once, in the nested service layout, and relocated

Templates are written in a single layout, the nested service project's. Other patterns and layouts are produced by relocation (`src/generate/relocate.ts`): each file is mapped to its project path and relative imports are rewritten to match, using the `@/` alias between top-level modules in a flat project. We chose this over keeping a copy of the templates per pattern and layout, which would roughly quadruple them and let the copies drift apart.

## Consequences

- Every new file at a feature-module root must be added to `ROLE_FOLDER_BY_FILE_NAME`, or composing a CQRS project fails.
- Paths in README sections go through `projectPath()` or `projectFolder()` instead of being written out.
- Configs that differ by layout (`tsconfig.json`, `vitest.config*.ts`, `nest-cli.json`) live in the `layout/<layout>` layers.
