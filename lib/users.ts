import { google } from 'googleapis';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { MOCK_USERS, normalizeRole, type MockUser, type UserRole } from '@/config/mock-users';
import { invalidateAll } from './cache';

export type ManagedUser = MockUser;

const USERS_SHEET = 'Users';
const USERS_HEADER = ['Email', 'Name', 'Role', 'Password'];

// ─── Password hashing (never stored in plain text) ─────

const PBKDF2_ITERATIONS = 100_000;

/** Hash a plain-text password with a random salt: "sha256$<salt>$<hash>". */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return `sha256$${salt}$${hash}`;
}

/**
 * Verify a plain-text password against a stored value.
 * Supports hashed values (sha256$...) and legacy plain-text rows
 * (kept working for existing users; upgraded to a hash on next write).
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (stored.startsWith('sha256$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const candidate = pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
    try {
      return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }
  // Legacy plain-text row (pre-hashing migration)
  return stored === plain;
}

/** True if the stored value is a legacy plain-text password that should be re-hashed. */
export function isLegacyPlainPassword(stored: string): boolean {
  return stored !== '' && !stored.startsWith('sha256$');
}

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
    // Seed with mock users (passwords hashed — never stored in plain text)
    const seedValues = MOCK_USERS.map((u) => [u.email, u.name, u.role, hashPassword(u.password)]);
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
      role: normalizeRole((row[2] || 'operator').toString()),
      password: (row[3] || '').toString(),
    });
  }

  return users;
}

export async function addUser(data: {
  email: string;
  name: string;
  role: UserRole;
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
      requestBody: { values: [[email, data.name, data.role, hashPassword(data.password)]] },
    }),
  );

  invalidateAll();
  return { email, name: data.name, role: data.role, password: data.password };
}

export async function updateUser(
  email: string,
  data: { name?: string; role?: UserRole; password?: string },
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
      const existingRole = normalizeRole((row[2] || 'operator').toString());
      const updated = {
        email: emailLower,
        name: data.name ?? (row[1] || '').toString(),
        role: data.role ?? existingRole,
        password: data.password != null ? hashPassword(data.password) : (row[3] || '').toString(),
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
