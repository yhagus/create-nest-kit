/** A shallow copy with keys in alphabetical order, so rendered files don't depend on layer order. */
export function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b, 'en')),
  );
}
