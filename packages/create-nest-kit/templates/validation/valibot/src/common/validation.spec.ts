import { HttpStatus } from '@nestjs/common';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-code.js';
import { toErrorBody } from './http-exception.filter.js';
import { createValidationPipe, toRequestSchema } from './validation.js';

const OrderDto = v.strictObject({
  email: v.pipe(v.string(), v.email()),
  address: v.strictObject({ city: v.string() }),
  items: v.optional(v.array(v.strictObject({ quantity: v.pipe(v.number(), v.integer()) }))),
  tags: v.optional(v.array(v.string())),
});

/** The error body the API answers `body` with, or a failed test if the pipe accepts it. */
async function errorBodyFor(body: unknown) {
  try {
    await createValidationPipe().transform(body, {
      type: 'body',
      schema: toRequestSchema(OrderDto),
    });
  } catch (error) {
    return toErrorBody(error);
  }
  throw new Error('expected the pipe to reject its input');
}

describe('createValidationPipe', () => {
  it('reports every failing field as VALIDATION_FAILED, nested ones by path, sorted by field', async () => {
    const body = await errorBodyFor({ email: 'not-an-email', address: {} });

    expect(body).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: ErrorCode.ValidationFailed,
      message: 'Validation failed',
      details: [
        { field: 'address.city', errors: [expect.any(String)] },
        { field: 'email', errors: [expect.any(String)] },
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

  it('reports every unknown property of an object, not only the first', async () => {
    const body = await errorBodyFor({
      email: 'ada@example.com',
      address: { city: 'London' },
      admin: true,
      role: 'owner',
    });

    expect(body.details).toEqual([
      { field: 'admin', errors: [expect.any(String)] },
      { field: 'role', errors: [expect.any(String)] },
    ]);
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
