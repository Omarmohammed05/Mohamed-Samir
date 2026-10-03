import { google } from 'googleapis';
import { normalizeDate } from './date';
import {
  listAll, listForUser, getEntry, upsertEntry, deleteEntry,
  type Entry,
} from './mock-store';
import {
  listAllExcel, listForUserExcel, getEntryExcel, upsertEntryExcel, deleteEntryExcel,
} from './excel-store';
import { invalidateAll } from './cache';

const HEADER = ['Date', 'User', 'A', 'B', 'C', 'D', 'UpdatedAt'];

function isMock(): boolean {
  return process.env.SHEETS_MODE === 'mock' || !process.env.SHEETS_MODE;
}

function isExcel(): boolean {
  return process.env.SHEETS_MODE === 'excel';
}

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
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
    }
  }
  throw new Error('unreachable');
}

export type SheetRow = Entry;

export type ListResult = {
  entries: Entry[];
  warnings: string[];
};

export async function listEntries(): Promise<ListResult> {
  if (isMock()) {
    return { entries: listAll(), warnings: [] };
  }
  if (isExcel()) {
    return listAllExcel();
  }

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entries!A:G' }),
  );

  const rows = res.data.values || [];
  const warnings: string[] = [];
  const entries: Entry[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const date = normalizeDate(row[0]);
    const user = (row[1] || '').toString().toLowerCase().trim();

    if (!date) {
      warnings.push(`Row ${i + 1}: invalid or missing date "${row[0]}"`);
      continue;
    }
    if (!user) {
      warnings.push(`Row ${i + 1}: missing user`);
      continue;
    }

    const key = `${user}|${date}`;
    if (seen.has(key)) {
      warnings.push(`Duplicate row for ${user} on ${date} — showing first occurrence`);
      continue;
    }
    seen.add(key);

    entries.push({
      date,
      user,
      a: (row[2] || '').toString(),
      b: (row[3] || '').toString(),
      c: (row[4] || '').toString(),
      d: (row[5] || '').toString(),
      updatedAt: (row[6] || '').toString(),
    });
  }

  return { entries, warnings };
}

export async function getUserEntries(user: string): Promise<Entry[]> {
  if (isMock()) {
    return listForUser(user);
  }
  if (isExcel()) {
    return listForUserExcel(user);
  }
  const { entries } = await listEntries();
  return entries.filter((e) => e.user === user.toLowerCase());
}

export async function getEntryRow(user: string, date: string): Promise<Entry | null> {
  if (isMock()) {
    return getEntry(user, date) || null;
  }
  if (isExcel()) {
    return getEntryExcel(user, date);
  }
  const { entries } = await listEntries();
  return entries.find((e) => e.user === user.toLowerCase() && e.date === date) || null;
}

export async function upsertEntryRow(
  user: string,
  date: string,
  data: { a: string; b: string; c: string; d: string },
): Promise<Entry> {
  const updatedAt = new Date().toISOString();
  invalidateAll();

  if (isMock()) {
    return upsertEntry(user, date, data);
  }
  if (isExcel()) {
    return upsertEntryExcel(user, date, data);
  }

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  // Read all rows to find the matching one
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entries!A:G' }),
  );
  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = normalizeDate(row?.[0]);
    const rowUser = (row?.[1] || '').toString().toLowerCase().trim();
    if (rowDate === date && rowUser === user.toLowerCase()) {
      // Update in place
      await withRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Entries!C${i + 1}:G${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[data.a, data.b, data.c, data.d, updatedAt]] },
        }),
      );
      return { date, user: user.toLowerCase(), ...data, updatedAt };
    }
  }

  // Append
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Entries!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[date, user.toLowerCase(), data.a, data.b, data.c, data.d, updatedAt]],
      },
    }),
  );
  return { date, user: user.toLowerCase(), ...data, updatedAt };
}

export async function deleteEntryRow(user: string, date: string): Promise<boolean> {
  invalidateAll();

  if (isMock()) {
    return deleteEntry(user, date);
  }
  if (isExcel()) {
    return deleteEntryExcel(user, date);
  }

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entries!A:G' }),
  );
  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = normalizeDate(row?.[0]);
    const rowUser = (row?.[1] || '').toString().toLowerCase().trim();
    if (rowDate === date && rowUser === user.toLowerCase()) {
      await withRetry(() =>
        sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `Entries!A${i + 1}:G${i + 1}`,
        }),
      );
      return true;
    }
  }
  return false;
}

export { HEADER };
