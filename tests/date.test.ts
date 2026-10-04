import { describe, it, expect } from 'vitest';
import { normalizeDate, isValidDateString } from '@/lib/date';

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
