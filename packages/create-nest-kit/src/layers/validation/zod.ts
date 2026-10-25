import type { LayerManifest } from '../types.ts';

export const zodValidationLayer: LayerManifest = {
  id: 'validation/zod',
  status: 'ready',
  when: (options) => options.validation === 'zod',
  dependencies: {
    zod: '4.6.7',
  },
  readme: [
    {
      title: 'Validation (Zod)',
      body: `
Request bodies and query strings are validated with [Zod](https://zod.dev) schemas, one file per area: \`src/auth/auth.dto.ts\`, \`src/modules/users/users.dto.ts\`, \`src/modules/roles/roles.dto.ts\`.

- A DTO is a schema and the type inferred from it, under one name:

  \`\`\`ts
  export const CreateRoleDto = z.strictObject({
    name: z.string().trim().min(2),
    permissions: z.array(z.enum(Permission)),
  });
  export type CreateRoleDto = z.infer<typeof CreateRoleDto>;
  \`\`\`

- Use \`z.strictObject()\`, so unknown properties are rejected. Derive variants with \`.pick()\`, \`.partial()\` and \`.extend()\`.
- A handler takes the DTO with \`@ValidBody(CreateRoleDto) dto: CreateRoleDto\` or \`@ValidQuery(ListUsersQuery) query: ListUsersQuery\` (\`src/common/validation.ts\`). The global \`StandardSchemaValidationPipe\` validates the value with that schema and hands the handler its output, transforms and defaults applied.
- Every failing field is listed in the 400 \`VALIDATION_FAILED\` body as \`details: [{ field, errors }]\`.
- Query strings arrive as strings: convert numbers with \`z.coerce.number()\`, as \`PaginationQuery\` in \`users.dto.ts\` does.
- Swagger documents bodies and query parameters from the same schemas (their JSON Schema), so there is nothing to keep in sync.
- The env vars are validated by the Zod schema in \`src/config/env.schema.ts\`.
`,
    },
  ],
};
