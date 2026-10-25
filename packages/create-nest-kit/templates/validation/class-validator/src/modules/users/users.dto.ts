import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { IsOmittable } from '../../common/is-omittable.js';
import { PaginationQuery } from '../../common/pagination-query.dto.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/password-length.js';
import { NormalizeEmail, Trim } from '../../common/transforms.js';
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from './user.js';
import { USER_SEARCH_MAX_LENGTH } from './users.repository.js';

export class CreateUserDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name!: string;

  @IsOmittable()
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds?: string[];

  @IsOmittable()
  @IsBoolean()
  emailVerified?: boolean;
}

/** A new `password` signs the user out of every session; `roleIds` replaces their roles. */
export class UpdateUserDto extends PartialType(CreateUserDto, { skipNullProperties: false }) {}

export class ListUsersQuery extends PaginationQuery {
  /** Case-insensitive substring of the email or the name. */
  @IsOmittable()
  @Trim()
  @IsString()
  @MaxLength(USER_SEARCH_MAX_LENGTH)
  search?: string;
}
