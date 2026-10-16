import { describe, it, expect } from 'vitest';
import { normalizeDate, isValidDateString, nowCairoISO, nowCairoDateTime } from '@/lib/date';

describe('normalizeDate', () => {
  it('passes through YYYY-MM-DD', () => {
    expect(normalizeDate('2026-01-15')).toBe('2026-01-15');
  });

  it('normalizes D/M/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('15/1/2026')).toBe('2026-01-15');
    expect(normalizeDate('3/10/2026')).toBe('2026-10-03');
  });

  it('handles single-digit months/days with zero-padding', () => {
    expect(normalizeDate('2026-1-5')).toBe('2026-01-05');
  });

  it('converts Excel serial numbers', () => {
    // 2026-01-01 is roughly serial 46023
    const result = normalizeDate(46023);
    expect(result).toBe('2026-01-01');
  });

  it('converts Date objects', () => {
    expect(normalizeDate(new Date('2026-06-15T10:00:00Z'))).toBe('2026-06-15');
  });

  it('returns null for invalid strings', () => {
    expect(normalizeDate('not-a-date')).toBeNull();
  });

  it('returns null for null/empty', () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });
});

describe('isValidDateString', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(isValidDateString('2026-01-15')).toBe(true);
  });

  it('rejects wrong format', () => {
    expect(isValidDateString('15/01/2026')).toBe(false);
    expect(isValidDateString('2026-1-5')).toBe(false);
  });

  it('rejects impossible dates', () => {
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-02-30')).toBe(false);
  });
});

describe('nowCairoISO', () => {
  it('formats with the +03:00 offset during Egyptian DST (summer)', () => {
    expect(nowCairoISO(new Date('2026-10-15T12:05:32.000Z')))
      .toBe('2026-10-15T15:05:32+03:00');
  });

  it('formats with the +02:00 offset outside DST (winter)', () => {
    expect(nowCairoISO(new Date('2026-01-15T12:05:32.000Z')))
      .toBe('2026-01-15T14:05:32+02:00');
  });

  it('round-trips: parsing the string recovers the same instant', () => {
    const instant = new Date('2026-10-15T12:05:32.000Z');
    expect(new Date(nowCairoISO(instant)).getTime()).toBe(instant.getTime());
  });
});

describe('nowCairoDateTime', () => {
  it('returns Cairo date and time strings', () => {
    expect(nowCairoDateTime(new Date('2026-10-15T12:05:32.000Z')))
      .toEqual({ date: '2026-10-15', time: '15:05:32' });
  });

  it('rolls the date correctly near midnight Cairo', () => {
    // 22:00 UTC on Oct 15 is 01:00 Cairo on Oct 16 (DST, +03:00)
    expect(nowCairoDateTime(new Date('2026-10-15T22:00:00.000Z')))
      .toEqual({ date: '2026-10-16', time: '01:00:00' });
  });
});
