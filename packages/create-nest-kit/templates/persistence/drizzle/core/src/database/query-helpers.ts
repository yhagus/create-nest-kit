import { DrizzleQueryError } from 'drizzle-orm/errors';
import { DatabaseError } from 'pg';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/** Whether a query failed because it would break the unique constraint `constraint`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return violatedConstraint(error, UNIQUE_VIOLATION) === constraint;
}

/** Whether a query failed because it would break the foreign key `constraint`. */
export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return violatedConstraint(error, FOREIGN_KEY_VIOLATION) === constraint;
}

function violatedConstraint(error: unknown, sqlState: string): string | undefined {
  if (!(error instanceof DrizzleQueryError)) return undefined;
  const { cause } = error;
  if (!(cause instanceof DatabaseError) || cause.code !== sqlState) return undefined;
  return cause.constraint;
}

/** The single row an `insert ... returning` or `update ... returning` produced. */
export function firstRow<Row>(rows: Row[]): Row {
  const [row] = rows;
  if (row === undefined) throw new Error('Expected the query to return a row');
  return row;
}

/** A `like` pattern matching `text` anywhere, with `%`, `_` and `\` in it taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
