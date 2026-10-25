// Plain type guards for response bodies, so the tests read them the same way whichever
// validation library the app uses.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` narrowed by `guard`; otherwise fails, showing what came instead. */
export function expectShape<Shape>(
  value: unknown,
  guard: (value: unknown) => value is Shape,
  description: string,
): Shape {
  if (!guard(value)) {
    throw new Error(`Expected ${description}, got ${JSON.stringify(value)}`);
  }
  return value;
}
