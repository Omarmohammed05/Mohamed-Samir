import { google } from 'googleapis';
import { normalizeDate } from './date';
import {
  listAll, listForUser, getEntry, upsertEntry, deleteEntry,
  listDeleted, restoreEntry, type Entry,
} from './mock-store';
import {
  listAllExcel, listForUserExcel, getEntryExcel, upsertEntryExcel, deleteEntryExcel,
} from './excel-store';
import { invalidateAll } from './cache';
import { addAuditRecord, appendAuditToSheet, type AuditAction } from './audit';

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

async function logAudit(
  actor: string,
  action: AuditAction,
  targetUser: string,
  targetDate: string,
  details?: string,
): Promise<void> {
  const record = { actor, action, targetUser, targetDate, details };
  addAuditRecord(record);
  await appendAuditToSheet({ ...record, timestamp: new Date().toISOString() });
}

export async function upsertEntryRow(
  user: string,
  date: string,
  data: { a: string; b: string; c: string; d: string },
  actor?: string,
): Promise<Entry> {
  const updatedAt = new Date().toISOString();
  invalidateAll();
  const actorEmail = actor || user;
  const userLower = user.toLowerCase();

  if (isMock()) {
    const existed = getEntry(user, date);
    const result = upsertEntry(user, date, data);
    await logAudit(actorEmail, existed ? 'edit' : 'create', userLower, date);
    return result;
  }
  if (isExcel()) {
    const existed = await getEntryExcel(user, date);
    const result = upsertEntryExcel(user, date, data);
    await logAudit(actorEmail, existed ? 'edit' : 'create', userLower, date);
    return result;
  }

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  // Read all rows to find the matching one
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Entries!A:G' }),
  );
  const rows = res.data.values || [];
  let isEdit = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = normalizeDate(row?.[0]);
    const rowUser = (row?.[1] || '').toString().toLowerCase().trim();
    if (rowDate === date && rowUser === userLower) {
      isEdit = true;
      // Update in place
      await withRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Entries!C${i + 1}:G${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[data.a, data.b, data.c, data.d, updatedAt]] },
        }),
      );
      break;
    }
  }

  if (!isEdit) {
    // Append
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Entries!A:G',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[date, userLower, data.a, data.b, data.c, data.d, updatedAt]],
        },
      }),
    );
  }

  await logAudit(actorEmail, isEdit ? 'edit' : 'create', userLower, date);
  return { date, user: userLower, ...data, updatedAt };
}

export async function deleteEntryRow(user: string, date: string, actor?: string): Promise<boolean> {
  invalidateAll();
  const actorEmail = actor || user;
  const userLower = user.toLowerCase();

  if (isMock()) {
    const result = deleteEntry(user, date);
    if (result) await logAudit(actorEmail, 'delete', userLower, date);
    return result;
  }
  if (isExcel()) {
    const result = await deleteEntryExcel(user, date);
    if (result) await logAudit(actorEmail, 'delete', userLower, date);
    return result;
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
    if (rowDate === date && rowUser === userLower) {
      // Soft delete — copy to Deleted tab, then clear from Entries
      const deletedRow = [
        row[0] || date, row[1] || userLower, row[2] || '', row[3] || '',
        row[4] || '', row[5] || '', row[6] || '',
        new Date().toISOString(), actorEmail,
      ];
      await ensureDeletedSheet(sheets, sheetId);
      await withRetry(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Deleted!A:I',
          valueInputOption: 'RAW',
          requestBody: { values: [deletedRow] },
        }),
      );
      await withRetry(() =>
        sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `Entries!A${i + 1}:G${i + 1}`,
        }),
      );
      await logAudit(actorEmail, 'delete', userLower, date);
      return true;
    }
  }
  return false;
}

const DELETED_HEADER = ['Date', 'User', 'A', 'B', 'C', 'D', 'UpdatedAt', 'DeletedAt', 'DeletedBy'];

async function ensureDeletedSheet(sheets: ReturnType<typeof google.sheets>, sheetId: string): Promise<void> {
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Deleted!A1:A1' }),
    );
  } catch {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Deleted' } } }] },
      }),
    );
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Deleted!A1:I1',
        valueInputOption: 'RAW',
        requestBody: { values: [DELETED_HEADER] },
      }),
    );
  }
}

export async function listDeletedEntries(): Promise<Entry[]> {
  if (isMock()) return listDeleted();
  if (isExcel()) return [];

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureDeletedSheet(sheets, sheetId);
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Deleted!A:G' }),
  );
  const rows = res.data.values || [];
  const entries: Entry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;
    const date = normalizeDate(row[0]);
    const user = (row[1] || '').toString().toLowerCase().trim();
    if (!date || !user) continue;
    entries.push({
      date, user,
      a: (row[2] || '').toString(), b: (row[3] || '').toString(),
      c: (row[4] || '').toString(), d: (row[5] || '').toString(),
      updatedAt: (row[6] || '').toString(),
    });
  }
  return entries;
}

export async function restoreEntryRow(user: string, date: string, actor: string): Promise<boolean> {
  invalidateAll();
  const userLower = user.toLowerCase();

  if (isMock()) {
    const result = restoreEntry(user, date);
    if (result) await logAudit(actor, 'restore', userLower, date);
    return result;
  }

  // For excel mode, no Deleted sheet — return false
  if (isExcel()) return false;

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureDeletedSheet(sheets, sheetId);

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Deleted!A:I' }),
  );
  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = normalizeDate(row?.[0]);
    const rowUser = (row?.[1] || '').toString().toLowerCase().trim();
    if (rowDate === date && rowUser === userLower) {
      // Append back to Entries
      await withRetry(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Entries!A:G',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[row[0], rowUser, row[2] || '', row[3] || '', row[4] || '', row[5] || '', row[6] || '']],
          },
        }),
      );
      // Clear from Deleted
      await withRetry(() =>
        sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `Deleted!A${i + 1}:I${i + 1}`,
        }),
      );
      await logAudit(actor, 'restore', userLower, date);
      return true;
    }
  }
  return false;
}

export { HEADER };
