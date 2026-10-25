import { type } from 'arktype';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/pagination.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/password-length.js';
import { normalizeEmail } from './email.js';
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from './user.js';
import { USER_SEARCH_MAX_LENGTH } from './users.repository.js';

/** Normalized first, so `' Ada@Example.com'` is accepted and stored as `ada@example.com`. */
export const email = type('string').pipe(normalizeEmail).to('string.email');

export const password = type(`${PASSWORD_MIN_LENGTH} <= string <= ${PASSWORD_MAX_LENGTH}`);

export const CreateUserDto = type({
  '+': 'reject',
  email: email.to(`string <= ${EMAIL_MAX_LENGTH}`),
  password,
  name: `string.trim |> 0 < string <= ${USER_NAME_MAX_LENGTH}`,
  'roleIds?': 'string.uuid[]',
  'emailVerified?': 'boolean',
});
export type CreateUserDto = typeof CreateUserDto.infer;

/** A new `password` signs the user out of every session; `roleIds` replaces their roles. */
export const UpdateUserDto = CreateUserDto.partial();
export type UpdateUserDto = typeof UpdateUserDto.infer;

/**
 * `?page=1&limit=20`. Extend it with `.merge({ '+': 'reject', … })` for list endpoints that take
 * more filters. Query values arrive as strings, defaults included, and are parsed to numbers.
 */
export const PaginationQuery = type({
  '+': 'reject',
  page: type('string.integer.parse |> number >= 1').default(String(DEFAULT_PAGE)),
  limit: type(`string.integer.parse |> 1 <= number <= ${MAX_PAGE_SIZE}`).default(
    String(DEFAULT_PAGE_SIZE),
  ),
});

export const ListUsersQuery = PaginationQuery.merge({
  '+': 'reject',
  /** Case-insensitive substring of the email or the name. */
  'search?': `string.trim |> string <= ${USER_SEARCH_MAX_LENGTH}`,
});
export type ListUsersQuery = typeof ListUsersQuery.infer;
