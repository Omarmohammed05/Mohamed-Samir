import { google } from 'googleapis';
import { MOCK_USERS, type MockUser } from '@/config/mock-users';
import { invalidateAll } from './cache';

export type ManagedUser = MockUser;

const USERS_SHEET = 'Users';
const USERS_HEADER = ['Email', 'Name', 'Role', 'Password'];

function isReal(): boolean {
  return process.env.SHEETS_MODE === 'real';
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

/** Create the Users sheet with header + seed data if it doesn't exist yet. */
async function ensureUsersSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  try {
    await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${USERS_SHEET}!A1:D1` }),
    );
  } catch {
    // Sheet doesn't exist — create it
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: USERS_SHEET } } }],
        },
      }),
    );
    // Write header
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${USERS_SHEET}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: { values: [USERS_HEADER] },
      }),
    );
    // Seed with mock users
    const seedValues = MOCK_USERS.map((u) => [u.email, u.name, u.role, u.password]);
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${USERS_SHEET}!A:D`,
        valueInputOption: 'RAW',
        requestBody: { values: seedValues },
      }),
    );
  }
}

export async function listUsers(): Promise<ManagedUser[]> {
  if (!isReal()) {
    return MOCK_USERS.map((u) => ({ ...u }));
  }

  await ensureUsersSheet();
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${USERS_SHEET}!A:D` }),
  );

  const rows = res.data.values || [];
  const users: ManagedUser[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;
    users.push({
      email: (row[0] || '').toString().toLowerCase().trim(),
      name: (row[1] || '').toString(),
      role: ((row[2] || 'user').toString() as 'user' | 'admin'),
      password: (row[3] || '').toString(),
    });
  }

  return users;
}

export async function addUser(data: {
  email: string;
  name: string;
  role: 'user' | 'admin';
  password: string;
}): Promise<ManagedUser> {
  if (!isReal()) throw new Error('User management requires Google Sheets mode (SHEETS_MODE=real)');

  await ensureUsersSheet();
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const existing = await listUsers();
  const email = data.email.toLowerCase().trim();
  if (existing.find((u) => u.email === email)) {
    throw new Error('User with this email already exists');
  }

  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${USERS_SHEET}!A:D`,
      valueInputOption: 'RAW',
      requestBody: { values: [[email, data.name, data.role, data.password]] },
    }),
  );

  invalidateAll();
  return { email, name: data.name, role: data.role, password: data.password };
}

export async function updateUser(
  email: string,
  data: { name?: string; role?: 'user' | 'admin'; password?: string },
): Promise<ManagedUser> {
  if (!isReal()) throw new Error('User management requires Google Sheets mode (SHEETS_MODE=real)');

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const emailLower = email.toLowerCase().trim();

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${USERS_SHEET}!A:D` }),
  );
  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = (row?.[0] || '').toString().toLowerCase().trim();
    if (rowEmail === emailLower) {
      const updated = {
        email: emailLower,
        name: data.name ?? (row[1] || '').toString(),
        role: data.role ?? ((row[2] || 'user').toString() as 'user' | 'admin'),
        password: data.password ?? (row[3] || '').toString(),
      };
      await withRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${USERS_SHEET}!A${i + 1}:D${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[updated.email, updated.name, updated.role, updated.password]] },
        }),
      );
      invalidateAll();
      return updated;
    }
  }

  throw new Error('User not found');
}

export async function deleteUser(email: string): Promise<boolean> {
  if (!isReal()) throw new Error('User management requires Google Sheets mode (SHEETS_MODE=real)');

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const emailLower = email.toLowerCase().trim();

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${USERS_SHEET}!A:D` }),
  );
  const rows = res.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowEmail = (row?.[0] || '').toString().toLowerCase().trim();
    if (rowEmail === emailLower) {
      await withRetry(() =>
        sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `${USERS_SHEET}!A${i + 1}:D${i + 1}`,
        }),
      );
      invalidateAll();
      return true;
    }
  }

  return false;
}
