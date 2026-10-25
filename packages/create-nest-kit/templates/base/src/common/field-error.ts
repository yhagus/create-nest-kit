/**
 * One failing field in the `details` of a VALIDATION_FAILED error. Every validation library's
 * pipe reports failures in this shape, so clients see the same `details` whichever one is used.
 */
export interface FieldError {
  /** Dotted path of the property, e.g. `address.city` or `items.0.quantity`. */
  field: string;
  /** Human-readable messages; their wording depends on the validation library. */
  errors: string[];
}

/**
 * The order of `details`: by field, comparing numeric path segments as numbers (`items.2` before
 * `items.10`). Libraries report failures in different orders, so every pipe sorts with this.
 */
export function compareFieldErrors(a: FieldError, b: FieldError): number {
  return a.field.localeCompare(b.field, 'en', { numeric: true });
}
