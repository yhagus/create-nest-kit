import {
  type ArgumentMetadata,
  BadRequestException,
  Body,
  type PipeTransform,
  Query,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { z } from 'zod';
import { ErrorCode } from './error-code.js';
import { compareFieldErrors, type FieldError } from './field-error.js';

/** A Standard Schema issue, as Nest's pipe hands it to `exceptionFactory`. */
interface SchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

/**
 * The global pipe: validates every `@ValidBody()` and `@ValidQuery()` parameter against its
 * schema and reports every failing field in `details`. Parameters without a schema pass through.
 */
export function createValidationPipe(): PipeTransform {
  return new SchemaValidationPipe();
}

/**
 * The request body, validated and transformed by `schema`. Swagger documents the body from the
 * same schema. Use a `z.strictObject()`, so unknown properties are rejected.
 */
export function ValidBody(schema: z.ZodType): ParameterDecorator {
  return Body({ schema });
}

/** The query string, validated and transformed by `schema`; Swagger documents each parameter. */
export function ValidQuery(schema: z.ZodType): ParameterDecorator {
  return Query({ schema });
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

/** One entry per field, with all of its messages, sorted by field. */
function toFieldErrors(issues: readonly SchemaIssue[]): FieldError[] {
  const errorsByField = new Map<string, string[]>();
  for (const { field, message } of issues.flatMap(toFieldFailures)) {
    errorsByField.set(field, [...(errorsByField.get(field) ?? []), message]);
  }
  return [...errorsByField].map(([field, errors]) => ({ field, errors })).sort(compareFieldErrors);
}

/**
 * Zod reports unknown properties as one issue on their parent object; each becomes its own field.
 * A failing value of a list (`roleIds.1`) is reported at the list, as class-validator does, while
 * a field of a list element keeps its index (`items.1.quantity`).
 */
function toFieldFailures(issue: SchemaIssue): { field: string; message: string }[] {
  const path = (issue.path ?? []).map((segment) =>
    typeof segment === 'object' ? segment.key : segment,
  );
  const unknownKeys = unrecognizedKeysOf(issue);
  if (unknownKeys.length > 0) {
    return unknownKeys.map((key) => ({
      field: toField([...path, key]),
      message: `Unrecognized key: "${key}"`,
    }));
  }
  return [{ field: toField(withoutTrailingIndexes(path)), message: issue.message }];
}

function unrecognizedKeysOf(issue: SchemaIssue): string[] {
  if (!('code' in issue) || issue.code !== 'unrecognized_keys') return [];
  if (!('keys' in issue) || !Array.isArray(issue.keys)) return [];
  return issue.keys.filter((key): key is string => typeof key === 'string');
}

function withoutTrailingIndexes(path: readonly PropertyKey[]): PropertyKey[] {
  const end = path.findLastIndex((segment) => typeof segment !== 'number') + 1;
  return path.slice(0, end);
}

function toField(path: readonly PropertyKey[]): string {
  return path.map(String).join('.');
}
