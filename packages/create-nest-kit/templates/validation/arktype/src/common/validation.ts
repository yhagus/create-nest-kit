import {
  type ArgumentMetadata,
  BadRequestException,
  Body,
  type PipeTransform,
  Query,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { type } from 'arktype';
import { ErrorCode } from './error-code.js';
import { compareFieldErrors, type FieldError } from './field-error.js';

/** A Standard Schema issue, as Nest's pipe hands it to `exceptionFactory`. */
interface SchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

/** What `@nestjs/swagger` reads a parameter's schema from, and the pipe validates with. */
type StandardSchema = Pick<type.Any, '~standard'>;

/**
 * The global pipe: validates every `@ValidBody()` and `@ValidQuery()` parameter against its
 * schema and reports every failing field in `details`. Parameters without a schema pass through.
 */
export function createValidationPipe(): PipeTransform {
  return new SchemaValidationPipe();
}

/**
 * The request body, validated and transformed by `schema`. Swagger documents the body from the
 * same schema. Declare its objects with `"+": "reject"`, so unknown properties are rejected.
 */
export function ValidBody(schema: type.Any): ParameterDecorator {
  return Body({ schema: withOpenApiJsonSchema(schema) });
}

/** The query string, validated and transformed by `schema`; Swagger documents each parameter. */
export function ValidQuery(schema: type.Any): ParameterDecorator {
  return Query({ schema: withOpenApiJsonSchema(schema) });
}

/**
 * `schema`, except that it answers Swagger's request for an `openapi-3.0` JSON Schema, which
 * ArkType refuses, with its draft-07 one. The keywords ArkType writes for these DTOs (`type`,
 * `properties`, `required`, `pattern`, `enum`, lengths, inclusive bounds) mean the same in both.
 */
function withOpenApiJsonSchema(schema: type.Any): StandardSchema {
  const standard = schema['~standard'];
  return {
    '~standard': {
      ...standard,
      jsonSchema: {
        input: (options) => standard.jsonSchema.input({ ...options, target: 'draft-07' }),
        output: (options) => standard.jsonSchema.output({ ...options, target: 'draft-07' }),
      },
    },
  };
}

/**
 * Nest's Standard Schema pipe, except that a request without a body is validated as `{}`, as
 * class-validator's pipe does, so each missing field is reported rather than the body as a whole.
 */
class SchemaValidationPipe implements PipeTransform {
  private readonly pipe = new StandardSchemaValidationPipe({
    exceptionFactory: (issues: readonly SchemaIssue[]) =>
      new BadRequestException(
        { message: 'Validation failed', details: toFieldErrors(issues) },
        { errorCode: ErrorCode.ValidationFailed },
      ),
  });

  transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const isMissingBody = metadata.schema !== undefined && value === undefined;
    return this.pipe.transform(isMissingBody ? {} : value, metadata);
  }
}

/**
 * One entry per field, with all of its messages, sorted by field. It reports
 * each unknown property as an issue of its own, at the property's path.
 */
function toFieldErrors(issues: readonly SchemaIssue[]): FieldError[] {
  const errorsByField = new Map<string, string[]>();
  for (const issue of issues) {
    const field = toField(issue);
    errorsByField.set(field, [...(errorsByField.get(field) ?? []), issue.message]);
  }
  return [...errorsByField].map(([field, errors]) => ({ field, errors })).sort(compareFieldErrors);
}

/**
 * The dotted path of the failing property. A failing value of a list (`roleIds.1`) is reported at
 * the list, as class-validator does, while a field of a list element keeps its index
 * (`items.1.quantity`).
 */
function toField(issue: SchemaIssue): string {
  const path = (issue.path ?? []).map((segment) =>
    typeof segment === 'object' ? segment.key : segment,
  );
  return withoutTrailingIndexes(path).map(String).join('.');
}

function withoutTrailingIndexes(path: readonly PropertyKey[]): PropertyKey[] {
  const end = path.findLastIndex((segment) => typeof segment !== 'number') + 1;
  return path.slice(0, end);
}
