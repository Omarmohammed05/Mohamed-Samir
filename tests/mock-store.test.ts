import { describe, it, expect, beforeEach } from 'vitest';
import {
  listAll, listForUser, getEntry, upsertEntry, deleteEntry, _resetStore,
} from '@/lib/mock-store';

describe('mock-store', () => {
  beforeEach(() => _resetStore());

  it('listAll returns all entries sorted newest first', () => {
    const all = listAll();
    expect(all.length).toBe(2);
    expect(all[0].date >= all[1].date).toBe(true);
  });

  it('listForUser filters by user', () => {
    expect(listForUser('sara@team.com').length).toBe(2);
    expect(listForUser('nobody@team.com').length).toBe(0);
  });

  it('listForUser is case-insensitive', () => {
    expect(listForUser('SARA@TEAM.COM').length).toBe(2);
  });

  it('upsertEntry creates new entry', () => {
    const entry = upsertEntry('omar@team.com', '2026-05-01', { a: 'A', b: 'B', c: 'C', d: 'D' });
    expect(entry.a).toBe('A');
    expect(getEntry('omar@team.com', '2026-05-01')).toBeDefined();
  });

  it('upsertEntry updates existing entry (no duplicate)', () => {
    upsertEntry('sara@team.com', '2026-05-01', { a: 'old', b: 'B', c: 'C', d: 'D' });
    upsertEntry('sara@team.com', '2026-05-01', { a: 'new', b: 'B', c: 'C', d: 'D' });
    expect(listForUser('sara@team.com').length).toBe(3); // 2 seed + 1 new
    const entry = getEntry('sara@team.com', '2026-05-01');
    expect(entry?.a).toBe('new');
  });

  it('deleteEntry removes entry', () => {
    const before = listForUser('sara@team.com').length;
    const today = listForUser('sara@team.com')[0].date;
    expect(deleteEntry('sara@team.com', today)).toBe(true);
    expect(listForUser('sara@team.com').length).toBe(before - 1);
  });

  it('deleteEntry returns false for non-existent', () => {
    expect(deleteEntry('nobody@team.com', '2026-01-01')).toBe(false);
  });

  it('getEntry is case-insensitive on user', () => {
    expect(getEntry('SARA@team.com', listForUser('sara@team.com')[0].date)).toBeDefined();
  });
});
