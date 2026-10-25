import type { LayerManifest } from '../types.ts';

export const classValidatorValidationLayer: LayerManifest = {
  id: 'validation/class-validator',
  status: 'ready',
  when: (options) => options.validation === 'class-validator',
  dependencies: {
    'class-transformer': '0.5.1',
    'class-validator': '0.15.1',
  },
  readme: [
    {
      title: 'Validation (class-validator)',
      body: `
Request bodies and query strings are validated with [class-validator](https://github.com/typestack/class-validator) DTO classes, one file per area: \`src/auth/auth.dto.ts\`, \`src/modules/users/users.dto.ts\`, \`src/modules/roles/roles.dto.ts\`.

- A DTO is a class with a decorator per rule. \`Trim()\` and \`NormalizeEmail()\` (\`src/common/transforms.ts\`) clean a value before it is checked; derive variants with \`PickType\` and \`PartialType\` from \`@nestjs/swagger\`.
- A handler takes the DTO with \`@ValidBody(CreateUserDto) dto: CreateUserDto\` or \`@ValidQuery(ListUsersQuery) query: ListUsersQuery\` (\`src/common/validation.ts\`). The global \`ValidationPipe\` validates against the parameter's declared class, so declare it with the same class.
- Unknown properties are rejected. Every failing field is listed in the 400 \`VALIDATION_FAILED\` body as \`details: [{ field, errors }]\`.
- An optional property may be left out but never \`null\`. Mark it with \`@IsOmittable()\` (\`src/common/is-omittable.ts\`), not \`@IsOptional()\`, which also lets \`null\` through. Derive update DTOs with \`PartialType(Dto, { skipNullProperties: false })\` for the same reason.
- Query strings arrive as strings: convert numbers with \`@Type(() => Number)\`, as \`PaginationQuery\` (\`src/common/pagination-query.dto.ts\`) does.
- The Swagger CLI plugin (\`nest-cli.json\`) documents the DTO classes in files ending in \`.dto.ts\` from their types, decorators and comments.
- The env vars are validated by the \`EnvironmentVariables\` class in \`src/config/env.schema.ts\`.
`,
    },
  ],
};
