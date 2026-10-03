/**
 * Date helpers — normalize Google Sheets date formats to YYYY-MM-DD
 * and compute "today" in the Africa/Cairo time zone.
 */

const CAIRO_TZ = 'Africa/Cairo';

/** Returns the current date as YYYY-MM-DD in Africa/Cairo. */
export function todayCairo(): string {
  return new Date()
    .toLocaleDateString('en-CA', {
      timeZone: CAIRO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
}

/** Excel serial-date epoch (1899-12-30, accounting for the 1900 leap-year bug). */
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Normalize any value a Google Sheet cell might contain into YYYY-MM-DD.
 * Tolerates: serial numbers, D/M/YYYY, M/D/YYYY, YYYY-MM-DD, Date objects, ISO strings.
 */
export function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  // Already ISO-ish
  if (typeof value === 'string') {
    const s = value.trim();

    // YYYY-MM-DD (already canonical)
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return pad(m[1], m[2], m[3]);

    // D/M/YYYY or DD/MM/YYYY  (Google Sheets default for non-US locales)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return pad(m[3], m[2], m[1]);

    // M/D/YYYY  (US locale) — detect by checking if month > 12 in first position
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      // If first part > 12, it must be D/M/YYYY
      if (a > 12) return pad(m[3], m[2], m[1]);
      // Default to D/M/YYYY (non-US) — admin can review
      return pad(m[3], m[2], m[1]);
    }

    // Fallback: try Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  // Numeric — Excel serial date
  if (typeof value === 'number') {
    const ms = SERIAL_EPOCH + value * 86_400_000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  // Date object
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return null;
  }

  return null;
}

function pad(year: string, month: string, day: string): string {
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Validate that a string is a valid YYYY-MM-DD date. */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Format YYYY-MM-DD for display in a given locale. */
export function formatDisplay(date: string, locale: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: CAIRO_TZ,
  });
}
