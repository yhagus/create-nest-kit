import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/pagination.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/password-length.js';
import { normalizeEmail } from './email.js';
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from './user.js';
import { USER_SEARCH_MAX_LENGTH } from './users.repository.js';

/** Normalized first, so `' Ada@Example.com'` is accepted and stored as `ada@example.com`. */
export const email = (): z.ZodString => z.string().overwrite(normalizeEmail).check(z.email());

export const password = (): z.ZodString =>
  z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const CreateUserDto = z.strictObject({
  email: email().max(EMAIL_MAX_LENGTH),
  password: password(),
  name: z.string().trim().min(1).max(USER_NAME_MAX_LENGTH),
  roleIds: z.array(z.uuid()).optional(),
  emailVerified: z.boolean().optional(),
});
export type CreateUserDto = z.infer<typeof CreateUserDto>;

/** A new `password` signs the user out of every session; `roleIds` replaces their roles. */
export const UpdateUserDto = CreateUserDto.partial();
export type UpdateUserDto = z.infer<typeof UpdateUserDto>;

/** `?page=1&limit=20`. Extend it for list endpoints that take more filters. */
export const PaginationQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const ListUsersQuery = PaginationQuery.extend({
  /** Case-insensitive substring of the email or the name. */
  search: z.string().trim().max(USER_SEARCH_MAX_LENGTH).optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersQuery>;
