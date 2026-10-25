import { readdir } from 'node:fs/promises';
import path from 'node:path';
import mongoose, { Schema } from 'mongoose';

const SCHEMA_FILE = /\.schema\.[jt]s$/;

/** The dropped index names, by collection. */
export type DroppedIndexes = Record<string, string[]>;

/**
 * Every schema exported by a `*.schema.ts` file in `schemasDir` (`*.schema.js` once compiled).
 * Reading the folder, rather than a list, lets each layer add its own schema files.
 */
export async function importSchemas(schemasDir: string): Promise<Schema[]> {
  const files = (await readdir(schemasDir)).filter((file) => SCHEMA_FILE.test(file));
  // A module namespace object: one property per export.
  const modules: Record<string, unknown>[] = await Promise.all(
    files.map((file) => import(path.join(schemasDir, file))),
  );
  return modules.flatMap((module) =>
    Object.values(module).filter((value) => value instanceof Schema),
  );
}

/**
 * Creates the indexes the schemas declare and drops the ones they no longer declare. Idempotent,
 * so it is this project's migration: `db:migrate` runs it, and so does the test setup.
 */
export async function syncIndexes(uri: string, schemas: Schema[]): Promise<DroppedIndexes> {
  const connection = await mongoose.createConnection(uri, { autoIndex: false }).asPromise();
  try {
    for (const schema of schemas) {
      const collection = collectionOf(schema);
      connection.model(collection, schema);
    }
    return await connection.syncIndexes();
  } finally {
    await connection.close();
  }
}

/** Each schema names its collection, so it can double as a model name here. */
function collectionOf(schema: Schema): string {
  const collection: unknown = schema.get('collection');
  if (typeof collection !== 'string') {
    throw new Error('Every schema must set its collection: @Schema({ collection: "..." })');
  }
  return collection;
}
