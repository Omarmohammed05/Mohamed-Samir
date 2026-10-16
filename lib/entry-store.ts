/**
 * Card entry store — the single source of truth for card submissions
 * with the approval workflow. Works in mock (in-memory), excel (JSON file),
 * and real (Google Sheets) modes.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { todayCairo } from './date';
import { invalidateAll } from './cache';
import { formatDuration, parseDuration } from './duration';
import type { UserRole } from '@/config/mock-users';

export type EntryStatus = 'Operator' | 'Supervisor' | 'Engineer';

export type CardEntry = {
  id: string;
  card_id: string;
  status: EntryStatus;
  operator_name: string;
  supervisor_name: string;
  engineer_name: string;
  duration_seconds: number | null;
  created_at: string;
  supervisor_approved_at: string | null;
  engineer_approved_at: string | null;
  last_edited_by: string;
  last_edited_at: string;
  user_email: string;
  /** Process values: array of [equipment, tagNo, unit, description, min, norm, max, value] */
  rows: string[][];
};

const STORE_PATH = path.join(process.cwd(), 'data', 'card-entries.json');

function isMock(): boolean {
  return process.env.SHEETS_MODE === 'mock' || !process.env.SHEETS_MODE;
}

function isExcel(): boolean {
  return process.env.SHEETS_MODE === 'excel';
}

function isReal(): boolean {
  return process.env.SHEETS_MODE === 'real';
}

// ─── In-memory store (mock mode) ────────────────────────

const memoryStore: CardEntry[] = [];

// ─── JSON file store (excel mode) ──────────────────────

async function readJsonStore(): Promise<CardEntry[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as CardEntry[];
  } catch {
    return [];
  }
}

async function writeJsonStore(entries: CardEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

// ─── Google Sheets store (real mode) ───────────────────

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || (status && status >= 500);
      if (!retryable || attempt === retries) throw err;
      // Per-minute quota: back off long enough for the window to reset.
      const delay = status === 429 ? 10_000 * (attempt + 1) : 2 ** attempt * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

const ENTRIES_TAB = 'CardEntries';
const ENTRIES_HEADER = [
  'ID', 'Card ID', 'Status',
  'Operator Name', 'Supervisor Name', 'Engineer Name',
  'Duration', 'Created At', 'Supervisor Approved At', 'Engineer Approved At',
  'Last Edited By', 'Last Edited At', 'User Email', 'Values',
];

function entryToRow(e: CardEntry): string[] {
  return [
    e.id, e.card_id, e.status,
    e.operator_name, e.supervisor_name, e.engineer_name,
    e.duration_seconds != null ? formatDuration(e.duration_seconds) : '',
    e.created_at, e.supervisor_approved_at || '', e.engineer_approved_at || '',
    e.last_edited_by, e.last_edited_at, e.user_email,
    JSON.stringify(e.rows),
  ];
}

function rowToEntry(row: string[]): CardEntry {
  return {
    id: row[0] || '',
    card_id: row[1] || '',
    status: (row[2] || 'Engineer') as EntryStatus,
    operator_name: row[3] || '',
    supervisor_name: row[4] || '',
    engineer_name: row[5] || '',
    duration_seconds: parseDuration(row[6]),
    created_at: row[7] || '',
    supervisor_approved_at: row[8] || null,
    engineer_approved_at: row[9] || null,
    last_edited_by: row[10] || '',
    last_edited_at: row[11] || '',
    user_email: row[12] || '',
    rows: row[13] ? safeParseRows(row[13]) : [],
  };
}

function safeParseRows(json: string): string[][] {
  try {
    return JSON.parse(json) as string[][];
  } catch {
    return [];
  }
}

// Shared in-flight promise: the tab is verified/created once per process,
// and concurrent callers reuse the same check instead of each hitting the API.
let entriesTabEnsurePromise: Promise<void> | null = null;

export function ensureEntriesTab(): Promise<void> {
  if (!entriesTabEnsurePromise) {
    entriesTabEnsurePromise = doEnsureEntriesTab().catch((err) => {
      entriesTabEnsurePromise = null; // allow retry on the next call
      throw err;
    });
  }
  return entriesTabEnsurePromise;
}

async function doEnsureEntriesTab(): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  // Check tab existence via spreadsheet metadata — a failed values.get can
  // mean a transient quota error, not a missing tab.
  const meta = await withRetry(() =>
    sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties.title',
    }),
  );
  const titles = (meta.data.sheets || []).map((s) => s.properties?.title);
  if (!titles.includes(ENTRIES_TAB)) {
    try {
      await withRetry(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: ENTRIES_TAB } } }] },
        }),
      );
    } catch (err: unknown) {
      // A concurrent request may have added the tab first — tolerate that.
      const msg = String((err as { message?: string })?.message || '');
      if (!msg.includes('already exists')) throw err;
    }
  }

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${ENTRIES_TAB}!A1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [ENTRIES_HEADER] },
    }),
  );
}

// ─── Unified API ───────────────────────────────────────

function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Determine the initial status for a new entry based on the creator's role.
 * - Operator → "Operator" (goes to Supervisor)
 * - Supervisor → "Supervisor" (goes directly to Engineer)
 * - Admin → "Engineer" (final, since Admin has full access)
 */
export function initialStatusForRole(role: UserRole): EntryStatus {
  if (role === 'operator') return 'Operator';
  if (role === 'supervisor') return 'Supervisor';
  return 'Engineer'; // admin and engineer create final entries
}

export async function createEntry(params: {
  card_id: string;
  rows: string[][];
  user_email: string;
  user_name: string;
  user_role: UserRole;
  duration_seconds: number | null;
}): Promise<CardEntry> {
  invalidateAll();
  const now = new Date().toISOString();
  const status = initialStatusForRole(params.user_role);
  const entry: CardEntry = {
    id: generateId(),
    card_id: params.card_id,
    status,
    operator_name: params.user_name,
    supervisor_name: '',
    engineer_name: '',
    duration_seconds: params.duration_seconds,
    created_at: now,
    supervisor_approved_at: null,
    engineer_approved_at: null,
    last_edited_by: params.user_name,
    last_edited_at: now,
    user_email: params.user_email,
    rows: params.rows,
  };

  if (isMock()) {
    memoryStore.push(entry);
    return entry;
  }

  if (isExcel()) {
    const entries = await readJsonStore();
    entries.push(entry);
    await writeJsonStore(entries);
    return entry;
  }

  // Real mode — Google Sheets
  await ensureEntriesTab();
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${ENTRIES_TAB}!A:N`,
      valueInputOption: 'RAW',
      requestBody: { values: [entryToRow(entry)] },
    }),
  );
  return entry;
}

export async function getEntry(id: string): Promise<CardEntry | null> {
  const entries = await listAllEntries();
  return entries.find((e) => e.id === id) || null;
}

export async function updateEntry(
  id: string,
  updates: Partial<Pick<CardEntry, 'rows' | 'status' | 'supervisor_name' | 'engineer_name' | 'supervisor_approved_at' | 'engineer_approved_at' | 'last_edited_by' | 'last_edited_at'>>,
): Promise<CardEntry | null> {
  invalidateAll();

  if (isMock()) {
    const idx = memoryStore.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    memoryStore[idx] = { ...memoryStore[idx], ...updates };
    return memoryStore[idx];
  }

  if (isExcel()) {
    const entries = await readJsonStore();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    entries[idx] = { ...entries[idx], ...updates };
    await writeJsonStore(entries);
    return entries[idx];
  }

  // Real mode — find and update row in Google Sheets
  await ensureEntriesTab();
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${ENTRIES_TAB}!A:N` }),
  );
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.[0] === id) {
      const entry = rowToEntry(rows[i]);
      const updated = { ...entry, ...updates };
      await withRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${ENTRIES_TAB}!A${i + 1}:N${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [entryToRow(updated)] },
        }),
      );
      return updated;
    }
  }
  return null;
}

export async function listAllEntries(): Promise<CardEntry[]> {
  if (isMock()) {
    return [...memoryStore].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (isExcel()) {
    const entries = await readJsonStore();
    return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // Real mode
  await ensureEntriesTab();
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${ENTRIES_TAB}!A:N` }),
  );
  const rows = res.data.values || [];
  const entries: CardEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;
    entries.push(rowToEntry(row));
  }
  return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * List entries pending review for a given role.
 * - Supervisor: entries with status "Operator"
 * - Engineer: entries with status "Supervisor"
 */
export async function listPendingEntries(role: UserRole): Promise<CardEntry[]> {
  const entries = await listAllEntries();
  if (role === 'supervisor') {
    return entries.filter((e) => e.status === 'Operator');
  }
  if (role === 'engineer') {
    return entries.filter((e) => e.status === 'Supervisor');
  }
  // Admin sees all non-final
  if (role === 'admin') {
    return entries.filter((e) => e.status !== 'Engineer');
  }
  return [];
}

/**
 * List entries from the last N days (inclusive of today).
 */
export async function listRecentEntries(days: number): Promise<CardEntry[]> {
  const entries = await listAllEntries();
  const today = todayCairo();
  const cutoff = new Date(today + 'T00:00:00');
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.created_at.slice(0, 10) >= cutoffStr);
}

/**
 * List entries for a specific card.
 */
export async function listEntriesForCard(cardId: string): Promise<CardEntry[]> {
  const entries = await listAllEntries();
  return entries.filter((e) => e.card_id === cardId);
}
