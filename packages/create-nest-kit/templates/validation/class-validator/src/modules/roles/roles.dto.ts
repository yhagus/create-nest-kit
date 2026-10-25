import { PartialType } from '@nestjs/swagger';
import { IsArray, IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { IsOmittable } from '../../common/is-omittable.js';
import { Trim } from '../../common/transforms.js';
import { Permission } from '../permissions/permission.js';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_PATTERN } from './role.js';

export class CreateRoleDto {
  /** Lower-case letters, digits and dashes, starting with a letter; 2 to 49 characters. */
  @Matches(ROLE_NAME_PATTERN, {
    message: 'name must be 2-49 lower-case letters, digits or dashes, starting with a letter',
  })
  name!: string;

  @IsOmittable()
  @Trim()
  @IsString()
  @MaxLength(ROLE_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto, { skipNullProperties: false }) {}
