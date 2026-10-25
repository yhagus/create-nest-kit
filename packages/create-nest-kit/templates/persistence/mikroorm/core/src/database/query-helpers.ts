import {
  DriverException,
  ForeignKeyConstraintViolationException,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';

/**
 * The error a write failed with, as one of MikroORM's exceptions. The EntityManager's methods
 * already throw those, but `qb.execute()` throws the driver's own error.
 */
export function toDriverException(em: EntityManager, error: unknown): unknown {
  if (error instanceof DriverException || !(error instanceof Error)) return error;
  return em.getDriver().convertException(error);
}

/** Whether a query failed because it would break the unique constraint `constraint`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof UniqueConstraintViolationException && violatedConstraint(error) === constraint
  );
}

/** Whether a query failed because it would break the foreign key `constraint`. */
export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof ForeignKeyConstraintViolationException &&
    violatedConstraint(error) === constraint
  );
}

/** MikroORM copies every field of the driver's error onto its exception; pg names the constraint. */
function violatedConstraint(error: DriverException): unknown {
  return Reflect.get(error, 'constraint');
}

/**
 * `fields` without the ones that are undefined. The query builder writes an undefined value as
 * null, while the repository ports mean "leave it as it is".
 */
export function definedFields<Fields extends object>(fields: Fields): Partial<Fields> {
  const defined: Partial<Fields> = {};
  for (const key in fields) {
    if (fields[key] !== undefined) defined[key] = fields[key];
  }
  return defined;
}

/** A `like` pattern matching `text` anywhere, with `%`, `_` and `\` in it taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
