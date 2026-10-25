import type { LayerManifest } from '../types.ts';

export const arktypeValidationLayer: LayerManifest = {
  id: 'validation/arktype',
  status: 'ready',
  when: (options) => options.validation === 'arktype',
  dependencies: {
    arktype: '2.2.9',
  },
  readme: [
    {
      title: 'Validation (ArkType)',
      body: `
Request bodies and query strings are validated with [ArkType](https://arktype.io) types, one file per area: \`src/auth/auth.dto.ts\`, \`src/modules/users/users.dto.ts\`, \`src/modules/roles/roles.dto.ts\`.

- A DTO is a type and the type inferred from it, under one name:

  \`\`\`ts
  export const CreateRoleDto = type({
    '+': 'reject',
    name: 'string.trim |> string >= 2',
    permissions: type.valueOf(Permission).array(),
  });
  export type CreateRoleDto = typeof CreateRoleDto.infer;
  \`\`\`

- Start every object with \`'+': 'reject'\`, so unknown properties are rejected. Derive variants with \`.pick()\`, \`.partial()\` and \`.merge({ '+': 'reject', … })\`.
- \`|>\` pipes a value on to the next type: \`string.trim |> string >= 2\` trims, then checks the length.
- A handler takes the DTO with \`@ValidBody(CreateRoleDto) dto: CreateRoleDto\` or \`@ValidQuery(ListUsersQuery) query: ListUsersQuery\` (\`src/common/validation.ts\`). The global \`StandardSchemaValidationPipe\` validates the value with that type and hands the handler its output, pipes and defaults applied.
- Every failing field is listed in the 400 \`VALIDATION_FAILED\` body as \`details: [{ field, errors }]\`, sorted by field.
- Query strings arrive as strings: convert numbers with \`string.integer.parse\`, as \`PaginationQuery\` in \`users.dto.ts\` does.
- Swagger documents bodies and query parameters from the same types (their JSON Schema), so there is nothing to keep in sync.
- The env vars are validated by the ArkType type in \`src/config/env.schema.ts\`.
`,
    },
  ],
};
