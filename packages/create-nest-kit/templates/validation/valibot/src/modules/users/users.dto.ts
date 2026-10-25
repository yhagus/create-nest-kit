import * as v from 'valibot';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/pagination.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/password-length.js';
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from './user.js';
import { USER_SEARCH_MAX_LENGTH } from './users.repository.js';

/**
 * Normalized first, as `normalizeEmail()` does, so `' Ada@Example.com'` is accepted and stored as
 * `ada@example.com`. Valibot's own actions keep the email format in the Swagger docs.
 */
export const email = () => v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());

export const password = () =>
  v.pipe(v.string(), v.minLength(PASSWORD_MIN_LENGTH), v.maxLength(PASSWORD_MAX_LENGTH));

export const CreateUserDto = v.strictObject({
  email: v.pipe(email(), v.maxLength(EMAIL_MAX_LENGTH)),
  password: password(),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(USER_NAME_MAX_LENGTH)),
  roleIds: v.optional(v.array(v.pipe(v.string(), v.uuid()))),
  emailVerified: v.optional(v.boolean()),
});
export type CreateUserDto = v.InferOutput<typeof CreateUserDto>;

/** A new `password` signs the user out of every session; `roleIds` replaces their roles. */
export const UpdateUserDto = v.partial(CreateUserDto);
export type UpdateUserDto = v.InferOutput<typeof UpdateUserDto>;

/** A positive whole number from the query string, where every value arrives as a string. */
const queryInteger = () => v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1));

/**
 * `?page=1&limit=20`. Extend it for list endpoints that take more filters. The defaults are query
 * strings too, converted like the values a client sends.
 */
export const PaginationQuery = v.strictObject({
  page: v.optional(queryInteger(), String(DEFAULT_PAGE)),
  limit: v.optional(v.pipe(queryInteger(), v.maxValue(MAX_PAGE_SIZE)), String(DEFAULT_PAGE_SIZE)),
});

export const ListUsersQuery = v.strictObject({
  ...PaginationQuery.entries,
  /** Case-insensitive substring of the email or the name. */
  search: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(USER_SEARCH_MAX_LENGTH))),
});
export type ListUsersQuery = v.InferOutput<typeof ListUsersQuery>;
