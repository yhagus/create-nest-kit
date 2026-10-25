import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../common/password-length.js';
import { CreateUserDto, email, password } from '../modules/users/users.dto.js';
import { TOKEN_MAX_LENGTH } from './token-length.js';

const token = () => z.string().min(1).max(TOKEN_MAX_LENGTH);

export const RegisterDto = CreateUserDto.pick({ email: true, password: true, name: true });
export type RegisterDto = z.infer<typeof RegisterDto>;

export const LoginDto = z.strictObject({
  email: email(),
  // No minimum: a password that is too short is simply wrong. The maximum bounds the hashing work.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginDto = z.infer<typeof LoginDto>;

/** Browsers send the refresh cookie instead and leave the body empty. */
export const RefreshDto = z.strictObject({
  refreshToken: token().optional(),
});
export type RefreshDto = z.infer<typeof RefreshDto>;

export const UpdateProfileDto = CreateUserDto.pick({ name: true });
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

export const ChangePasswordDto = z.strictObject({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: password(),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;

export const ForgotPasswordDto = CreateUserDto.pick({ email: true });
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;

export const ResendVerificationDto = CreateUserDto.pick({ email: true });
export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>;

/** The `token` of a verification link. */
export const VerifyEmailDto = z.strictObject({ token: token() });
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>;

/** The `token` of a reset link, and the new password. */
export const ResetPasswordDto = CreateUserDto.pick({ password: true }).extend({ token: token() });
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;
