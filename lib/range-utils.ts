/** Client-safe range utilities — no Node-only imports. */

export type FieldRange = { min: number; max: number };

/**
 * Returns true when `value` is a valid number outside the given range.
 * Non-numeric or empty values are never out of range.
 */
export function isOutOfRange(value: string, range: FieldRange): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  const num = Number(trimmed);
  if (Number.isNaN(num)) return false;
  return num < range.min || num > range.max;
}
