import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-code.js';
import { toErrorBody } from './http-exception.filter.js';

async function rejectionOf(pipeRun: Promise<unknown>): Promise<unknown> {
  try {
    await pipeRun;
  } catch (error) {
    return error;
  }
  throw new Error('expected the pipe to reject its input');
}

describe('toErrorBody', () => {
  it('keeps the errorCode an exception was thrown with', () => {
    const exception = new ConflictException('Email already registered', {
      errorCode: 'USER_EMAIL_TAKEN',
    });

    expect(toErrorBody(exception)).toEqual({
      statusCode: HttpStatus.CONFLICT,
      errorCode: 'USER_EMAIL_TAKEN',
      message: 'Email already registered',
    });
  });

  it('replaces an errorCode that is not one of ours by the one of its status', () => {
    // e.g. what @nestjs/authentication's guard throws when a request has no credentials.
    const exception = new UnauthorizedException(undefined, { errorCode: 'missing_credentials' });

    expect(toErrorBody(exception).errorCode).toBe(ErrorCode.Unauthenticated);
  });

  it.each([
    [new UnauthorizedException(), ErrorCode.Unauthenticated],
    [new ForbiddenException(), ErrorCode.Forbidden],
    [new NotFoundException(), ErrorCode.NotFound],
    [new ConflictException(), ErrorCode.Conflict],
    [new ThrottlerException(), ErrorCode.RateLimited],
    [new BadRequestException(), ErrorCode.BadRequest],
    [new PayloadTooLargeException(), ErrorCode.BadRequest],
  ])('derives the errorCode from the status of %o', (exception, errorCode) => {
    expect(toErrorBody(exception).errorCode).toBe(errorCode);
  });

  it('passes the details of a validation error through', () => {
    const details = [{ field: 'address.city', errors: ['city must be a string'] }];
    const exception = new BadRequestException(
      { message: 'Validation failed', details },
      { errorCode: ErrorCode.ValidationFailed },
    );

    expect(toErrorBody(exception)).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.ValidationFailed,
      message: 'Validation failed',
      details,
    });
  });

  it('answers a failed pipe other than validation with BAD_REQUEST, without details', async () => {
    const error = await rejectionOf(
      new ParseUUIDPipe().transform('not-a-uuid', { type: 'param', data: 'id' }),
    );

    expect(toErrorBody(error)).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.BadRequest,
      message: expect.any(String),
    });
  });

  it('answers a malformed body rejected by the platform with BAD_REQUEST', () => {
    const error = Object.assign(new SyntaxError('Unexpected end of JSON input'), {
      statusCode: HttpStatus.BAD_REQUEST,
    });

    expect(toErrorBody(error)).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.BadRequest,
      message: 'Unexpected end of JSON input',
    });
  });

  it('keeps the status of a client error raised by the platform', () => {
    const error = Object.assign(new Error('Unsupported Media Type: text/csv'), {
      statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    });

    expect(toErrorBody(error)).toEqual({
      statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      errorCode: ErrorCode.BadRequest,
      message: 'Unsupported Media Type: text/csv',
    });
  });

  it('hides the message of an unexpected error', () => {
    const error = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    expect(toErrorBody(error)).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.InternalError,
      message: 'Internal server error',
    });
  });
});
