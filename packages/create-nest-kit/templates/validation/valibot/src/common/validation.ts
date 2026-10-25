import {
  type ArgumentMetadata,
  BadRequestException,
  Body,
  type PipeTransform,
  Query,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { type StandardJsonSchema, toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { ErrorCode } from './error-code.js';
import { compareFieldErrors, type FieldError } from './field-error.js';

/** A Standard Schema issue, as Nest's pipe hands it to `exceptionFactory`. */
interface SchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

/** The only JSON Schema flavour Swagger asks for. */
const OPENAPI_TARGET = 'openapi-3.0';

/**
 * The global pipe: validates every `@ValidBody()` and `@ValidQuery()` parameter against its
 * schema and reports every failing field in `details`. Parameters without a schema pass through.
 */
export function createValidationPipe(): PipeTransform {
  return new SchemaValidationPipe();
}

/**
 * The request body, validated and transformed by `schema`. Swagger documents the body from the
 * same schema. Use a `v.strictObject()`, so unknown properties are rejected.
 */
export function ValidBody(schema: v.GenericSchema): ParameterDecorator {
  return Body({ schema: toRequestSchema(schema) });
}

/** The query string, validated and transformed by `schema`; Swagger documents each parameter. */
export function ValidQuery(schema: v.GenericSchema): ParameterDecorator {
  return Query({ schema: toRequestSchema(schema) });
}

/**
 * `schema` as `ValidBody()` and `ValidQuery()` hand it to Nest: a Standard Schema that the pipe
 * validates with, plus the JSON Schema that Swagger documents the parameter with.
 */
export function toRequestSchema(schema: v.GenericSchema): StandardJsonSchema<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'valibot',
      validate: (value) => {
        const result = v.safeParse(schema, value);
        if (result.success) return { value: result.output };
        return { issues: result.issues.flatMap((issue) => withEveryUnknownKey(schema, issue)) };
      },
      jsonSchema: {
        input: ({ target }) => toOpenApiSchema(schema, target, 'input'),
        output: ({ target }) => toOpenApiSchema(schema, target, 'output'),
      },
    },
  };
}

/** Transforms and custom checks have no JSON Schema equivalent, so the docs leave them out. */
function toOpenApiSchema(
  schema: v.GenericSchema,
  target: string,
  typeMode: 'input' | 'output',
): Record<string, unknown> {
  if (target !== OPENAPI_TARGET) {
    throw new Error(`Only ${OPENAPI_TARGET} JSON Schemas are generated, not ${target}`);
  }
  return { ...toJsonSchema(schema, { target, typeMode, errorMode: 'ignore' }) };
}

/**
 * Valibot's `strictObject()` reports only the first unknown key of an object. This lists every
 * unknown key of that object, each as an issue of its own.
 */
function withEveryUnknownKey(schema: v.GenericSchema, issue: v.BaseIssue<unknown>): SchemaIssue[] {
  const path = (issue.path ?? []).map(toPathKey);
  const lastItem = issue.path?.at(-1);
  if (issue.type !== 'strict_object' || lastItem?.type !== 'object' || lastItem.origin !== 'key') {
    return [{ message: issue.message, path }];
  }
  const objectPath = path.slice(0, -1);
  const declaredEntries = entriesAt(schema, objectPath);
  // A missing required key is reported the same way; it stays as it is.
  if (declaredEntries === undefined || Object.hasOwn(declaredEntries, lastItem.key)) {
    return [{ message: issue.message, path }];
  }
  return Object.keys(lastItem.input)
    .filter((key) => !Object.hasOwn(declaredEntries, key))
    .map((key) => ({ message: `Unknown key: "${key}"`, path: [...objectPath, key] }));
}

/** Array indexes stay numbers, so a failing value of a list can be told apart from a property. */
function toPathKey(item: v.IssuePathItem): PropertyKey {
  return typeof item.key === 'number' ? item.key : String(item.key);
}

/** The declared entries of the object schema at `path`, seen through `optional()` and arrays. */
function entriesAt(
  schema: unknown,
  path: readonly PropertyKey[],
): Record<string, unknown> | undefined {
  let current = schema;
  for (const key of path) {
    const entries = entriesOf(current);
    current = entries ? entries[String(key)] : unwrapped(current)?.item;
  }
  return entriesOf(current);
}

function entriesOf(schema: unknown): Record<string, unknown> | undefined {
  const entries = unwrapped(schema)?.entries;
  return isRecord(entries) ? entries : undefined;
}

/** The schema inside `optional()`, `nullable()` and the like. */
function unwrapped(schema: unknown): Record<string, unknown> | undefined {
  if (!isRecord(schema)) return undefined;
  return 'wrapped' in schema ? unwrapped(schema.wrapped) : schema;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  const end = path.findLastIndex((segment) => typeof segment !== 'number') + 1;
  return path.slice(0, end).map(String).join('.');
}
