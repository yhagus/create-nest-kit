import { mongo } from 'mongoose';

const DUPLICATE_KEY = 11000;

/** Whether a write failed because it would break the unique index on `field`. */
export function isDuplicateKey(error: unknown, field: string): boolean {
  if (!(error instanceof mongo.MongoServerError) || error.code !== DUPLICATE_KEY) return false;
  const keyPattern: unknown = error['keyPattern'];
  return typeof keyPattern === 'object' && keyPattern !== null && field in keyPattern;
}

/** A case-insensitive regex matching `text` anywhere, with regex syntax in it taken literally. */
export function containsIgnoringCase(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
