import { DatabaseError } from 'pg';
import {
  type DeleteResult,
  type ObjectLiteral,
  QueryFailedError,
  type Repository,
  type UpdateResult,
} from 'typeorm';

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
  if (!(error instanceof QueryFailedError)) return undefined;
  const { driverError } = error;
  if (!(driverError instanceof DatabaseError) || driverError.code !== sqlState) return undefined;
  return driverError.constraint;
}

/**
 * The entities an `update ... returning *` or `delete ... returning *` produced. TypeORM hands
 * back the raw rows, keyed by column name, so this maps them onto entity properties.
 */
export function returnedEntities<Entity extends ObjectLiteral>(
  repository: Repository<Entity>,
  result: UpdateResult | DeleteResult,
): Entity[] {
  const rows: unknown = result.raw;
  if (!Array.isArray(rows)) throw new Error('Expected the query to return rows');
  return rows.map((row: unknown) => toEntity(repository, row));
}

function toEntity<Entity extends ObjectLiteral>(
  repository: Repository<Entity>,
  row: unknown,
): Entity {
  if (typeof row !== 'object' || row === null) throw new Error('Expected a row object');
  const { driver } = repository.manager.dataSource;
  const entity = repository.create();
  for (const column of repository.metadata.columns) {
    const value: unknown = Reflect.get(row, column.databaseName);
    column.setEntityValue(entity, driver.prepareHydratedValue(value, column));
  }
  return entity;
}

/** A `like` pattern matching `text` anywhere, with `%`, `_` and `\` in it taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
