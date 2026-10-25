import type { LayerManifest } from '../types.ts';

export const valibotValidationLayer: LayerManifest = {
  id: 'validation/valibot',
  status: 'ready',
  when: (options) => options.validation === 'valibot',
  dependencies: {
    '@valibot/to-json-schema': '1.8.0',
    valibot: '1.5.0',
  },
  readme: [
    {
      title: 'Validation (Valibot)',
      body: `
Request bodies and query strings are validated with [Valibot](https://valibot.dev) schemas, one file per area: \`src/auth/auth.dto.ts\`, \`src/modules/users/users.dto.ts\`, \`src/modules/roles/roles.dto.ts\`.

- A DTO is a schema and the type inferred from it, under one name:

  \`\`\`ts
  export const CreateRoleDto = v.strictObject({
    name: v.pipe(v.string(), v.trim(), v.minLength(2)),
    permissions: v.array(v.enum(Permission)),
  });
  export type CreateRoleDto = v.InferOutput<typeof CreateRoleDto>;
  \`\`\`

- Use \`v.strictObject()\`, so unknown properties are rejected. Derive variants with \`v.pick()\`, \`v.partial()\`, and by spreading \`.entries\` into a new \`v.strictObject()\`.
- An optional property may be left out, but not sent as \`null\`: \`v.optional()\` accepts \`undefined\` only.
- A handler takes the DTO with \`@ValidBody(CreateRoleDto) dto: CreateRoleDto\` or \`@ValidQuery(ListUsersQuery) query: ListUsersQuery\` (\`src/common/validation.ts\`). The global \`StandardSchemaValidationPipe\` validates the value with that schema and hands the handler its output, transforms and defaults applied.
- Every failing field is listed in the 400 \`VALIDATION_FAILED\` body as \`details: [{ field, errors }]\`, every unknown property too.
- Query strings arrive as strings: convert numbers with \`v.toNumber()\`, as \`PaginationQuery\` in \`users.dto.ts\` does.
- Swagger documents bodies and query parameters from the same schemas, through [\`@valibot/to-json-schema\`](https://valibot.dev/guides/json-schema/), so there is nothing to keep in sync. Transforms and \`v.check()\` have no JSON Schema form and are left out of the docs.
- The env vars are validated by the Valibot schema in \`src/config/env.schema.ts\`.
`,
    },
  ],
};
