/**
 * Machine-readable codes sent as `errorCode` in every error body. Clients branch on
 * these, never on `message`. Throw a specific one with
 * `new ConflictException('...', { errorCode: ErrorCode.Conflict })`.
 */
export enum ErrorCode {
  ValidationFailed = 'VALIDATION_FAILED',
  BadRequest = 'BAD_REQUEST',
  Unauthenticated = 'AUTH_UNAUTHENTICATED',
  InvalidCredentials = 'AUTH_INVALID_CREDENTIALS',
  InvalidRefreshToken = 'AUTH_INVALID_REFRESH_TOKEN',
  InvalidToken = 'AUTH_INVALID_TOKEN',
  InvalidCurrentPassword = 'AUTH_INVALID_CURRENT_PASSWORD',
  EmailNotVerified = 'AUTH_EMAIL_NOT_VERIFIED',
  Forbidden = 'AUTH_FORBIDDEN',
  NotFound = 'NOT_FOUND',
  UserEmailTaken = 'USER_EMAIL_TAKEN',
  UserCannotDeleteSelf = 'USER_CANNOT_DELETE_SELF',
  RoleNameTaken = 'ROLE_NAME_TAKEN',
  RoleProtected = 'ROLE_PROTECTED',
  Conflict = 'CONFLICT',
  RateLimited = 'RATE_LIMITED',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
  InternalError = 'INTERNAL_ERROR',
}
