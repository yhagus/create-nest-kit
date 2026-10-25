import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ErrorCode } from '../common/error-code.js';

// Thrown by every auth style, so clients see the same status, errorCode and message whichever one runs.

/** Wrong email or password. Deliberately the same for an unknown email. */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email or password', { errorCode: ErrorCode.InvalidCredentials });
  }
}

/** The refresh token is unknown, expired, revoked or was already rotated away. */
export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Invalid refresh token', { errorCode: ErrorCode.InvalidRefreshToken });
  }
}

/** An email-verification or password-reset token is unknown, expired or already used. */
export class InvalidTokenException extends BadRequestException {
  constructor() {
    super('Invalid or expired token', { errorCode: ErrorCode.InvalidToken });
  }
}

export class InvalidCurrentPasswordException extends BadRequestException {
  constructor() {
    super('Current password is incorrect', { errorCode: ErrorCode.InvalidCurrentPassword });
  }
}

export class EmailNotVerifiedException extends ForbiddenException {
  constructor() {
    super('Verify your email address before signing in', {
      errorCode: ErrorCode.EmailNotVerified,
    });
  }
}
