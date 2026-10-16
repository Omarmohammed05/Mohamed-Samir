/**
 * Pure duration helpers — safe to import from client components.
 */

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
