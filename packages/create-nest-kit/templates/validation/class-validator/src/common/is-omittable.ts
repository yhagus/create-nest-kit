import { ValidateIf } from 'class-validator';

/**
 * Use instead of `@IsOptional()` in request DTOs. The property may be left out, but a value that
 * is sent, `null` included, must pass the other validators: optional means "may be absent", never
 * "may be null" (docs/contract.md). `@IsOptional()` would also let `null` through.
 *
 * For a mapped DTO, pass the same rule to `PartialType`: `PartialType(Dto, { skipNullProperties: false })`.
 */
export const IsOmittable = (): PropertyDecorator =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
