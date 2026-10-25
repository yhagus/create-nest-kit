import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ErrorCode } from './error-code.js';

/** The body of every error response. */
export interface ErrorBody {
  statusCode: number;
  errorCode: string;
  message: string;
  /** Extra data, e.g. the failing fields of a validation error. */
  details?: unknown;
}

/**
 * The errorCode of an exception thrown without one of ours. A 400 is BAD_REQUEST here (e.g. a
 * malformed JSON body or a failed ParseUUIDPipe); VALIDATION_FAILED comes only with `details`,
 * from the validation pipe (see validation.ts).
 */
const ERROR_CODES_BY_STATUS: ReadonlyMap<number, ErrorCode> = new Map([
  [HttpStatus.BAD_REQUEST, ErrorCode.BadRequest],
  [HttpStatus.UNAUTHORIZED, ErrorCode.Unauthenticated],
  [HttpStatus.FORBIDDEN, ErrorCode.Forbidden],
  [HttpStatus.NOT_FOUND, ErrorCode.NotFound],
  [HttpStatus.CONFLICT, ErrorCode.Conflict],
  [HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RateLimited],
  [HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.ServiceUnavailable],
]);

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(ErrorCode));

/**
 * Turns every exception into `{ statusCode, errorCode, message }`. Replies through the
 * HTTP adapter, so it works on Fastify and Express alike.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    // Other 5xx (e.g. a failed health check's 503) are deliberate, not bugs.
    if (body.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, body.statusCode);
  }
}

export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }
  if (isFrameworkClientError(exception)) {
    // e.g. a malformed JSON body or an unsupported content type, rejected by the platform.
    return {
      statusCode: exception.statusCode,
      errorCode: defaultErrorCode(exception.statusCode),
      message: exception.message,
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode.InternalError,
    message: INTERNAL_ERROR_MESSAGE,
  };
}

function fromHttpException(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const body: ErrorBody = {
    statusCode,
    errorCode: ownErrorCode(exception) ?? defaultErrorCode(statusCode),
    message: messageOf(response) ?? exception.message,
  };
  if (isRecord(response) && response['details'] !== undefined) {
    body.details = response['details'];
  }
  return body;
}

/**
 * The errorCode the exception was thrown with, if it is one of ours. Libraries throw their own
 * (e.g. `missing_credentials`), which clients can't rely on, so those fall back to the status's.
 */
function ownErrorCode(exception: HttpException): string | undefined {
  const { errorCode } = exception;
  return errorCode !== undefined && KNOWN_ERROR_CODES.has(errorCode) ? errorCode : undefined;
}

function defaultErrorCode(statusCode: number): ErrorCode {
  const errorCode = ERROR_CODES_BY_STATUS.get(statusCode);
  if (errorCode) return errorCode;
  return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
    ? ErrorCode.InternalError
    : ErrorCode.BadRequest;
}

function messageOf(response: string | object): string | undefined {
  if (typeof response === 'string') return response;
  if (!isRecord(response)) return undefined;
  const message = response['message'];
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('; ');
  return undefined;
}

/** A 4xx error raised by Fastify or an Express middleware, which carries its status as `statusCode`. */
function isFrameworkClientError(error: unknown): error is Error & { statusCode: number } {
  if (!(error instanceof Error) || !('statusCode' in error)) return false;
  const { statusCode } = error;
  return (
    typeof statusCode === 'number' &&
    statusCode >= HttpStatus.BAD_REQUEST &&
    statusCode < HttpStatus.INTERNAL_SERVER_ERROR
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
