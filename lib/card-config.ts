/**
 * Card time-range config — min_seconds and max_seconds per card.
 * Admin-only setting. Used to color the Duration cell in the Google Sheet.
 * Stored as a JSON file in mock/excel mode, or a "CardConfig" sheet tab in real mode.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { CARD_TABS } from '@/config/cards';

export type CardTimeRange = {
  min_seconds: number;
  max_seconds: number;
};

export type CardConfigMap = Record<string, CardTimeRange>;

const CONFIG_PATH = path.join(process.cwd(), 'data', 'card-time-ranges.json');

const DEFAULT_RANGES: CardConfigMap = {};
for (const tab of CARD_TABS) {
  DEFAULT_RANGES[tab] = { min_seconds: 0, max_seconds: 0 };
}

export async function getCardConfig(): Promise<CardConfigMap> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CardConfigMap>;
    // Merge with defaults to ensure all cards are present
    const result: CardConfigMap = { ...DEFAULT_RANGES };
    for (const key of Object.keys(parsed)) {
      if (parsed[key]) {
        result[key] = {
          min_seconds: Number(parsed[key]!.min_seconds) || 0,
          max_seconds: Number(parsed[key]!.max_seconds) || 0,
        };
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_RANGES };
  }
}

export async function saveCardConfig(config: CardConfigMap): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function getCardTimeRange(cardId: string): Promise<CardTimeRange | null> {
  const config = await getCardConfig();
  return config[cardId] || null;
}

export { formatDuration, parseDuration } from './duration';

/**
 * Determine the color category for a duration value.
 * Returns 'high', 'low', or null (within range).
 */
export function getDurationColor(
  durationSeconds: number,
  range: CardTimeRange,
): 'high' | 'low' | null {
  // Only color if max_seconds is set (meaning admin configured ranges)
  if (range.max_seconds > 0 && durationSeconds > range.max_seconds) return 'high';
  if (range.min_seconds > 0 && durationSeconds < range.min_seconds) return 'low';
  return null;
}
