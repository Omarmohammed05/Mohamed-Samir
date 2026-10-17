/**
 * Card time-range config — min_seconds and max_seconds per card.
 * Admin-only setting. Used to color the Duration cell in the Google Sheet.
 * Stored as a JSON file in mock/excel mode, or a "CardConfig" sheet tab in real mode.
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  getDefaultCardConfig,
  type CardConfigMap,
  type CardTimeRange,
} from './card-config-utils';

export type { CardTimeRange, CardConfigMap } from './card-config-utils';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'card-time-ranges.json');

export async function getCardConfig(): Promise<CardConfigMap> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CardConfigMap>;
    // Merge with defaults to ensure all cards are present
    const result = getDefaultCardConfig();
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
    return getDefaultCardConfig();
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

// Re-export the pure helpers for server-side callers; client components should
// import directly from '@/lib/card-config-utils' to avoid pulling in `fs`.
export {
  formatDuration,
  parseDuration,
  getDurationColor,
} from './card-config-utils';
