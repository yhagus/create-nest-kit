import * as v from 'valibot';
import { Permission } from '../permissions/permission.js';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_PATTERN } from './role.js';

export const CreateRoleDto = v.strictObject({
  name: v.pipe(
    v.string(),
    v.regex(
      ROLE_NAME_PATTERN,
      'name must be 2-49 lower-case letters, digits or dashes, starting with a letter',
    ),
  ),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(ROLE_DESCRIPTION_MAX_LENGTH))),
  permissions: v.array(v.enum(Permission)),
});
export type CreateRoleDto = v.InferOutput<typeof CreateRoleDto>;

export const UpdateRoleDto = v.partial(CreateRoleDto);
export type UpdateRoleDto = v.InferOutput<typeof UpdateRoleDto>;
