import { todayCairo } from './date';

export type Entry = {
  date: string;     // YYYY-MM-DD
  user: string;     // lowercase email
  a: string;
  b: string;
  c: string;
  d: string;
  updatedAt: string; // ISO
};

const today = todayCairo();
const yesterday = new Date(today + 'T00:00:00');
yesterday.setDate(yesterday.getDate() - 1);
const y = yesterday.toISOString().slice(0, 10);
const twoDaysAgo = new Date(today + 'T00:00:00');
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const y2 = twoDaysAgo.toISOString().slice(0, 10);

// Soft-delete store — deleted entries go here instead of vanishing
const deletedStore: Entry[] = [];

// Seed with sample data
const store: Entry[] = [
  { date: today, user: 'sara@team.com', a: 'Reviewed Q4 report draft', b: 'Completed sections 1-3', c: 'Waiting on finance data', d: 'Need to sync with team Monday', updatedAt: new Date().toISOString() },
  { date: today, user: 'omar@team.com', a: 'Deployed v2.1 to staging', b: 'All tests passing', c: 'None', d: 'Ready for prod deploy Monday', updatedAt: new Date().toISOString() },
  { date: y, user: 'sara@team.com', a: 'Client meeting prep', b: 'Slides done', c: 'None', d: '', updatedAt: new Date(Date.now() - 86_400_000).toISOString() },
  { date: y, user: 'omar@team.com', a: 'Bug triage', b: 'Fixed 3 issues', c: 'Need design review on #42', d: '', updatedAt: new Date(Date.now() - 86_40_000).toISOString() },
  { date: y, user: 'layla@team.com', a: 'Updated onboarding docs', b: 'Added 2 new sections', c: 'None', d: 'Pushed to repo', updatedAt: new Date(Date.now() - 90_000_000).toISOString() },
  { date: y2, user: 'sara@team.com', a: 'Team standup notes', b: 'Discussed roadmap', c: 'Resource constraints', d: 'Follow up next week', updatedAt: new Date(Date.now() - 172_800_000).toISOString() },
  { date: y2, user: 'karim@team.com', a: 'Server maintenance', b: 'Patched 5 servers', c: 'None', d: 'All green', updatedAt: new Date(Date.now() - 172_800_000).toISOString() },
];

export function listAll(): Entry[] {
  return [...store].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export function listForUser(user: string): Entry[] {
  return store
    .filter((e) => e.user === user.toLowerCase())
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getEntry(user: string, date: string): Entry | undefined {
  return store.find((e) => e.user === user.toLowerCase() && e.date === date);
}

export function upsertEntry(user: string, date: string, data: { a: string; b: string; c: string; d: string }): Entry {
  const idx = store.findIndex((e) => e.user === user.toLowerCase() && e.date === date);
  const updatedAt = new Date().toISOString();
  if (idx >= 0) {
    store[idx] = { ...store[idx], ...data, updatedAt };
    return store[idx];
  }
  const entry: Entry = { date, user: user.toLowerCase(), ...data, updatedAt };
  store.push(entry);
  return entry;
}

export function deleteEntry(user: string, date: string): boolean {
  const idx = store.findIndex((e) => e.user === user.toLowerCase() && e.date === date);
  if (idx >= 0) {
    // Soft delete — move to deletedStore
    deletedStore.push(store[idx]);
    store.splice(idx, 1);
    return true;
  }
  return false;
}

export function listDeleted(): Entry[] {
  return [...deletedStore].sort((a, b) => b.date.localeCompare(a.date));
}

export function restoreEntry(user: string, date: string): boolean {
  const idx = deletedStore.findIndex((e) => e.user === user.toLowerCase() && e.date === date);
  if (idx >= 0) {
    store.push(deletedStore[idx]);
    deletedStore.splice(idx, 1);
    return true;
  }
  return false;
}

/** Reset the store to seed data (for tests). */
export function _resetStore(): void {
  store.length = 0;
  // Re-seed minimal data for tests
  store.push(
    { date: today, user: 'sara@team.com', a: 'A1', b: 'B1', c: 'C1', d: 'D1', updatedAt: new Date().toISOString() },
    { date: y, user: 'sara@team.com', a: 'A2', b: 'B2', c: 'C2', d: 'D2', updatedAt: new Date(Date.now() - 86_400_000).toISOString() },
  );
}
