import { Transform } from 'class-transformer';
import { normalizeEmail } from '../modules/users/email.js';

/** Trims a string property before validation; leaves other values for the validators to reject. */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Normalizes an email property before validation, as `normalizeEmail` does. */
export const NormalizeEmail = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
