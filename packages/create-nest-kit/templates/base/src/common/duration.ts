/** `<n>s|m|h|d`, e.g. `45s`, `15m`, `24h`, `30d`. */
export const DURATION_PATTERN = /^(\d+)([smhd])$/;

const MILLISECONDS_PER_UNIT: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** `'15m'` → `900000`. Throws on anything that doesn't match `DURATION_PATTERN`. */
export function parseDuration(value: string): number {
  const [, amount, unit] = DURATION_PATTERN.exec(value) ?? [];
  const unitMilliseconds = unit === undefined ? undefined : MILLISECONDS_PER_UNIT[unit];
  if (amount === undefined || unitMilliseconds === undefined) {
    throw new Error(`Invalid duration "${value}": expected <n>s|m|h|d, e.g. 15m`);
  }
  return Number(amount) * unitMilliseconds;
}
