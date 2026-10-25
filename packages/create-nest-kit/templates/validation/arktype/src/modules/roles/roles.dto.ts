import { type } from 'arktype';
import { Permission } from '../permissions/permission.js';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_PATTERN } from './role.js';

export const CreateRoleDto = type({
  '+': 'reject',
  name: type(ROLE_NAME_PATTERN).describe(
    '2-49 lower-case letters, digits or dashes, starting with a letter',
  ),
  'description?': `string.trim |> string <= ${ROLE_DESCRIPTION_MAX_LENGTH}`,
  permissions: type.valueOf(Permission).array(),
});
export type CreateRoleDto = typeof CreateRoleDto.infer;

export const UpdateRoleDto = CreateRoleDto.partial();
export type UpdateRoleDto = typeof UpdateRoleDto.infer;
