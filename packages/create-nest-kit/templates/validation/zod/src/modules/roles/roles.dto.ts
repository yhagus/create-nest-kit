import { z } from 'zod';
import { Permission } from '../permissions/permission.js';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_PATTERN } from './role.js';

export const CreateRoleDto = z.strictObject({
  name: z
    .string()
    .regex(
      ROLE_NAME_PATTERN,
      'name must be 2-49 lower-case letters, digits or dashes, starting with a letter',
    ),
  description: z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH).optional(),
  permissions: z.array(z.enum(Permission)),
});
export type CreateRoleDto = z.infer<typeof CreateRoleDto>;

export const UpdateRoleDto = CreateRoleDto.partial();
export type UpdateRoleDto = z.infer<typeof UpdateRoleDto>;
