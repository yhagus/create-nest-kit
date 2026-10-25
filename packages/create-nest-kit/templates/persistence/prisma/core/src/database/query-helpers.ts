import { Prisma } from '../generated/prisma/client.js';

/** Prisma's error codes: https://www.prisma.io/docs/orm/reference/error-reference */
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

/** Whether a write failed because it would break the unique constraint `constraint`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return violatedConstraint(error, UNIQUE_VIOLATION) === constraint;
}

/** Whether a write failed because it would break the foreign key `constraint`. */
export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return violatedConstraint(error, FOREIGN_KEY_VIOLATION) === constraint;
}

/** Whether an `update` or `delete` failed because no row matched its `where`. */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND;
}

function violatedConstraint(error: unknown, code: string): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== code) {
    return undefined;
  }
  return constraintIndexOf(error.meta);
}

/** Where the pg driver adapter reports the violated constraint's name in `error.meta`. */
function constraintIndexOf(meta: unknown): string | undefined {
  const index = ['driverAdapterError', 'cause', 'constraint', 'index'].reduce<unknown>(
    (value, key) => (isRecord(value) ? value[key] : undefined),
    meta,
  );
  return typeof index === 'string' ? index : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A `contains` filter value matching `text` literally: Prisma passes `%`, `_` and `\` on to LIKE. */
export function literalContains(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}
