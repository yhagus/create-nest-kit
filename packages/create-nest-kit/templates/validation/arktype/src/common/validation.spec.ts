import { HttpStatus } from '@nestjs/common';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-code.js';
import { toErrorBody } from './http-exception.filter.js';
import { createValidationPipe } from './validation.js';

const OrderDto = type({
  '+': 'reject',
  email: 'string.trim |> string.email',
  address: { '+': 'reject', city: 'string' },
  'items?': type({ '+': 'reject', quantity: 'number.integer' }).array(),
  'tags?': 'string[]',
});

/** The error body the API answers `body` with, or a failed test if the pipe accepts it. */
async function errorBodyFor(body: unknown) {
  try {
    await createValidationPipe().transform(body, { type: 'body', schema: OrderDto });
  } catch (error) {
    return toErrorBody(error);
  }
  throw new Error('expected the pipe to reject its input');
}

describe('createValidationPipe', () => {
  it('reports every failing field as VALIDATION_FAILED, nested ones by path, sorted by field', async () => {
    // ArkType checks the piped `email` last.
    const body = await errorBodyFor({ email: 'not-an-email', address: {}, tags: [1] });

    expect(body).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.ValidationFailed,
      message: 'Validation failed',
      details: [
        { field: 'address.city', errors: [expect.any(String)] },
        { field: 'email', errors: [expect.any(String)] },
        { field: 'tags', errors: [expect.any(String)] },
      ],
    });
  });

  it('reports unknown properties, nested ones too', async () => {
    const body = await errorBodyFor({
      email: 'ada@example.com',
      address: { city: 'London', zip: 'N1' },
      admin: true,
    });

    expect(body.details).toEqual(
      expect.arrayContaining([
        { field: 'admin', errors: [expect.any(String)] },
        { field: 'address.zip', errors: [expect.any(String)] },
      ]),
    );
    expect(body.details).toHaveLength(2);
  });

  it('reports a field of an array element by its index, and a failing value of a list at the list', async () => {
    const body = await errorBodyFor({
      email: 'ada@example.com',
      address: { city: 'London' },
      items: [{ quantity: 1 }, { quantity: 'two' }],
      tags: ['new', 3, 4],
    });

    expect(body.details).toEqual([
      { field: 'items.1.quantity', errors: [expect.any(String)] },
      { field: 'tags', errors: [expect.any(String), expect.any(String)] },
    ]);
  });

  it('validates a request without a body as an empty object', async () => {
    const body = await errorBodyFor(undefined);

    expect(body.details).toEqual([
      { field: 'address', errors: expect.any(Array) },
      { field: 'email', errors: [expect.any(String)] },
    ]);
  });
});
