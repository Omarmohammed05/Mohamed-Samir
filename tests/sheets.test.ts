import { describe, it, expect, beforeEach } from 'vitest';
import {
  listAll, upsertEntry, getEntry, listForUser, deleteEntry, _resetStore,
} from '@/lib/mock-store';

// Integration tests against the mock store, simulating the sheets module logic
describe('sheets integration (mock mode)', () => {
  beforeEach(() => _resetStore());

  it('upsert creates then updates same (user, date) without duplicates', () => {
    upsertEntry('sara@team.com', '2026-03-10', { a: 'v1', b: 'b', c: 'c', d: 'd' });
    upsertEntry('sara@team.com', '2026-03-10', { a: 'v2', b: 'b', c: 'c', d: 'd' });
    const entries = listAll().filter((e) => e.user === 'sara@team.com' && e.date === '2026-03-10');
    expect(entries.length).toBe(1);
    expect(entries[0].a).toBe('v2');
  });

  it('different users can have same date', () => {
    upsertEntry('sara@team.com', '2026-03-10', { a: 'A', b: 'b', c: 'c', d: 'd' });
    upsertEntry('omar@team.com', '2026-03-10', { a: 'A', b: 'b', c: 'c', d: 'd' });
    expect(getEntry('sara@team.com', '2026-03-10')).toBeDefined();
    expect(getEntry('omar@team.com', '2026-03-10')).toBeDefined();
    expect(listForUser('sara@team.com').filter((e) => e.date === '2026-03-10').length).toBe(1);
    expect(listForUser('omar@team.com').filter((e) => e.date === '2026-03-10').length).toBe(1);
  });

  it('updatedAt is set on upsert', () => {
    const entry = upsertEntry('sara@team.com', '2026-03-10', { a: 'A', b: 'b', c: 'c', d: 'd' });
    expect(entry.updatedAt).toBeTruthy();
    expect(new Date(entry.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('delete clears the row', () => {
    upsertEntry('sara@team.com', '2026-03-10', { a: 'A', b: 'b', c: 'c', d: 'd' });
    expect(deleteEntry('sara@team.com', '2026-03-10')).toBe(true);
    expect(getEntry('sara@team.com', '2026-03-10')).toBeUndefined();
  });
});
