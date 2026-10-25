import { type } from 'arktype';
import { PASSWORD_MAX_LENGTH } from '../common/password-length.js';
import { CreateUserDto, email, password } from '../modules/users/users.dto.js';
import { TOKEN_MAX_LENGTH } from './token-length.js';

const token = type(`0 < string <= ${TOKEN_MAX_LENGTH}`);

export const RegisterDto = CreateUserDto.pick('email', 'password', 'name');
export type RegisterDto = typeof RegisterDto.infer;

export const LoginDto = type({
  '+': 'reject',
  email,
  // No minimum: a password that is too short is simply wrong. The maximum bounds the hashing work.
  password: `0 < string <= ${PASSWORD_MAX_LENGTH}`,
});
export type LoginDto = typeof LoginDto.infer;

/** Browsers send the refresh cookie instead and leave the body empty. */
export const RefreshDto = type({
  '+': 'reject',
  'refreshToken?': token,
});
export type RefreshDto = typeof RefreshDto.infer;

export const UpdateProfileDto = CreateUserDto.pick('name');
export type UpdateProfileDto = typeof UpdateProfileDto.infer;

export const ChangePasswordDto = type({
  '+': 'reject',
  currentPassword: `0 < string <= ${PASSWORD_MAX_LENGTH}`,
  newPassword: password,
});
export type ChangePasswordDto = typeof ChangePasswordDto.infer;

export const ForgotPasswordDto = CreateUserDto.pick('email');
export type ForgotPasswordDto = typeof ForgotPasswordDto.infer;

export const ResendVerificationDto = CreateUserDto.pick('email');
export type ResendVerificationDto = typeof ResendVerificationDto.infer;

/** The `token` of a verification link. */
export const VerifyEmailDto = type({ '+': 'reject', token });
export type VerifyEmailDto = typeof VerifyEmailDto.infer;

/** The `token` of a reset link, and the new password. */
export const ResetPasswordDto = CreateUserDto.pick('password').merge({ '+': 'reject', token });
export type ResetPasswordDto = typeof ResetPasswordDto.infer;
