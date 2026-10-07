/**
 * Field range settings — configurable min/max per entry field.
 * Persisted to a JSON file so admins can change ranges at runtime.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { FIELDS } from '@/config/fields';
import type { FieldRange } from './range-utils';

export type FieldRanges = Record<string, FieldRange>;

const RANGES_PATH =
  process.env.FIELD_RANGES_PATH || path.join(process.cwd(), 'data', 'field-ranges.json');

/** Default ranges — arbitrary defaults for each field. */
export const DEFAULT_FIELD_RANGES: FieldRanges = {
  a: { min: 1, max: 2 },
  b: { min: 1, max: 5 },
  c: { min: 1, max: 3 },
  d: { min: 1, max: 4 },
};

export async function getFieldRanges(): Promise<FieldRanges> {
  try {
    const raw = await fs.readFile(RANGES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FieldRanges>;
    return { ...DEFAULT_FIELD_RANGES, ...parsed } as FieldRanges;
  } catch {
    return { ...DEFAULT_FIELD_RANGES };
  }
}

export async function saveFieldRanges(ranges: FieldRanges): Promise<void> {
  await fs.mkdir(path.dirname(RANGES_PATH), { recursive: true });
  await fs.writeFile(RANGES_PATH, JSON.stringify(ranges, null, 2), 'utf-8');
}

/** Validate a ranges object — returns cleaned ranges or throws. */
export function validateRanges(ranges: unknown): FieldRanges {
  if (!ranges || typeof ranges !== 'object') {
    throw new Error('Invalid ranges payload');
  }
  const cleaned: FieldRanges = {};
  for (const f of FIELDS) {
    const r = (ranges as Record<string, unknown>)[f.key];
    if (!r || typeof r !== 'object') {
      throw new Error(`Missing range for field "${f.key}"`);
    }
    const min = Number((r as { min: unknown }).min);
    const max = Number((r as { max: unknown }).max);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      throw new Error(`Range for field "${f.key}" must be numeric`);
    }
    if (min > max) {
      throw new Error(`Min cannot exceed max for field "${f.key}"`);
    }
    cleaned[f.key] = { min, max };
  }
  return cleaned;
}
