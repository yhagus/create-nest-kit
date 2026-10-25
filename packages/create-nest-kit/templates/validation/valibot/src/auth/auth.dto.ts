import * as v from 'valibot';
import { PASSWORD_MAX_LENGTH } from '../common/password-length.js';
import { CreateUserDto, email, password } from '../modules/users/users.dto.js';
import { TOKEN_MAX_LENGTH } from './token-length.js';

const token = () => v.pipe(v.string(), v.minLength(1), v.maxLength(TOKEN_MAX_LENGTH));

export const RegisterDto = v.pick(CreateUserDto, ['email', 'password', 'name']);
export type RegisterDto = v.InferOutput<typeof RegisterDto>;

export const LoginDto = v.strictObject({
  email: email(),
  // No minimum: a password that is too short is simply wrong. The maximum bounds the hashing work.
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(PASSWORD_MAX_LENGTH)),
});
export type LoginDto = v.InferOutput<typeof LoginDto>;

/** Browsers send the refresh cookie instead and leave the body empty. */
export const RefreshDto = v.strictObject({
  refreshToken: v.optional(token()),
});
export type RefreshDto = v.InferOutput<typeof RefreshDto>;

export const UpdateProfileDto = v.pick(CreateUserDto, ['name']);
export type UpdateProfileDto = v.InferOutput<typeof UpdateProfileDto>;

export const ChangePasswordDto = v.strictObject({
  currentPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(PASSWORD_MAX_LENGTH)),
  newPassword: password(),
});
export type ChangePasswordDto = v.InferOutput<typeof ChangePasswordDto>;

export const ForgotPasswordDto = v.pick(CreateUserDto, ['email']);
export type ForgotPasswordDto = v.InferOutput<typeof ForgotPasswordDto>;

export const ResendVerificationDto = v.pick(CreateUserDto, ['email']);
export type ResendVerificationDto = v.InferOutput<typeof ResendVerificationDto>;

/** The `token` of a verification link. */
export const VerifyEmailDto = v.strictObject({ token: token() });
export type VerifyEmailDto = v.InferOutput<typeof VerifyEmailDto>;

/** The `token` of a reset link, and the new password. */
export const ResetPasswordDto = v.strictObject({ password: password(), token: token() });
export type ResetPasswordDto = v.InferOutput<typeof ResetPasswordDto>;
