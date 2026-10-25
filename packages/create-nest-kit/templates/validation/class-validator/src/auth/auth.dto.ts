import { PickType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { IsOmittable } from '../common/is-omittable.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../common/password-length.js';
import { NormalizeEmail } from '../common/transforms.js';
import { CreateUserDto } from '../modules/users/users.dto.js';
import { TOKEN_MAX_LENGTH } from './token-length.js';

export class RegisterDto extends PickType(CreateUserDto, ['email', 'password', 'name']) {}

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  // No minimum: a password that is too short is simply wrong. The maximum bounds the hashing work.
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

/** Browsers send the refresh cookie instead and leave the body empty. */
export class RefreshDto {
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TOKEN_MAX_LENGTH)
  refreshToken?: string;
}

export class UpdateProfileDto extends PickType(CreateUserDto, ['name']) {}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword!: string;
}

export class ForgotPasswordDto extends PickType(CreateUserDto, ['email']) {}

export class ResendVerificationDto extends PickType(CreateUserDto, ['email']) {}

/** The `token` of a verification link. */
export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TOKEN_MAX_LENGTH)
  token!: string;
}

/** The `token` of a reset link, and the new password. */
export class ResetPasswordDto extends PickType(CreateUserDto, ['password']) {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TOKEN_MAX_LENGTH)
  token!: string;
}
