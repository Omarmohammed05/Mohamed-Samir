/**
 * Pure (client-safe) helpers and types for card time-range config.
 * Keep this module free of Node.js APIs so it can be imported from client
 * components without dragging `fs`/`path` into the browser bundle.
 */
import { CARD_TABS } from '@/config/cards';

export type CardTimeRange = {
  min_seconds: number;
  max_seconds: number;
};

export type CardConfigMap = Record<string, CardTimeRange>;

const DEFAULT_RANGES: CardConfigMap = {};
for (const tab of CARD_TABS) {
  DEFAULT_RANGES[tab] = { min_seconds: 0, max_seconds: 0 };
}

export function getDefaultCardConfig(): CardConfigMap {
  return { ...DEFAULT_RANGES };
}

/**
 * Format duration in seconds as mm:ss or hh:mm:ss if over an hour.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Parse a Duration cell back into raw seconds.
 * Accepts mm:ss, hh:mm:ss, and legacy raw-second values.
 */
export function parseDuration(value: string | null | undefined): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.length === 2 && parts.every((p) => !isNaN(p))) {
    return Math.round(parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3 && parts.every((p) => !isNaN(p))) {
    return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return null;
}

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
