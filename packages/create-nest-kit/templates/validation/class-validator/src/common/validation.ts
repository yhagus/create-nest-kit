import {
  BadRequestException,
  Body,
  Query,
  type Type,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { ErrorCode } from './error-code.js';
import { compareFieldErrors, type FieldError } from './field-error.js';

/**
 * The global pipe: validates every `@ValidBody()` and `@ValidQuery()` parameter against its
 * declared DTO class, rejects unknown properties and reports every failing field in `details`.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException(
        { message: 'Validation failed', details: toFieldErrors(errors).sort(compareFieldErrors) },
        { errorCode: ErrorCode.ValidationFailed },
      ),
  });
}

// The global ValidationPipe reads the DTO class from the parameter's declared type, so the
// argument only keeps controllers the same for every validation library. Declare the parameter
// with the same class: `@ValidBody(CreateUserDto) dto: CreateUserDto`.

/** The request body, validated against the DTO class `dto`. */
export function ValidBody(_dto: Type<object>): ParameterDecorator {
  return Body();
}

/** The query string, validated against the DTO class `dto`. */
export function ValidQuery(_dto: Type<object>): ParameterDecorator {
  return Query();
}

function toFieldErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, errors: Object.values(error.constraints) }] : [];
    return [...own, ...toFieldErrors(error.children ?? [], field)];
  });
}
