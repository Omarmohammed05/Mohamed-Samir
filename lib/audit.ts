/**
 * Audit log — records who created, edited, deleted, or restored what and when.
 * In-memory in mock/excel mode; persisted to an "Audit" sheet tab in real mode.
 */
import { google } from 'googleapis';
import { invalidateAll } from './cache';

export type AuditAction = 'create' | 'edit' | 'delete' | 'restore';

export interface AuditRecord {
  timestamp: string;   // ISO
  actor: string;       // email of who performed the action
  action: AuditAction;
  targetUser: string;
  targetDate: string;
  details?: string;
}

const AUDIT_HEADER = ['Timestamp', 'Actor', 'Action', 'TargetUser', 'TargetDate', 'Details'];

// In-memory store (used in all modes; real mode also mirrors to the sheet)
const auditLog: AuditRecord[] = [];

export function addAuditRecord(record: Omit<AuditRecord, 'timestamp'>): void {
  const entry: AuditRecord = { ...record, timestamp: new Date().toISOString() };
  auditLog.push(entry);
  // Keep in-memory log bounded
  if (auditLog.length > 500) auditLog.splice(0, auditLog.length - 500);
}

export function getAuditLog(): AuditRecord[] {
  return [...auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Real-mode sheet persistence ─────────────────────────

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

async function ensureAuditSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Audit!A1:F1' }),
    );
  } catch {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Audit' } } }] },
      }),
    );
    await withRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Audit!A1:F1',
        valueInputOption: 'RAW',
        requestBody: { values: [AUDIT_HEADER] },
      }),
    );
  }
}

export async function appendAuditToSheet(record: AuditRecord): Promise<void> {
  if (process.env.SHEETS_MODE !== 'real') return;
  try {
    await ensureAuditSheet();
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID!;
    await withRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Audit!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[record.timestamp, record.actor, record.action, record.targetUser, record.targetDate, record.details || '']],
        },
      }),
    );
  } catch (err) {
    console.error('[audit] Failed to write to sheet:', err instanceof Error ? err.message : 'unknown');
  }
}

export async function listAuditFromSheet(): Promise<AuditRecord[]> {
  if (process.env.SHEETS_MODE !== 'real') return getAuditLog();
  try {
    await ensureAuditSheet();
    const sheets = getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID!;
    const res = await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Audit!A:F' }),
    );
    const rows = res.data.values || [];
    const records: AuditRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((c) => !c)) continue;
      records.push({
        timestamp: (row[0] || '').toString(),
        actor: (row[1] || '').toString(),
        action: (row[2] || 'edit').toString() as AuditAction,
        targetUser: (row[3] || '').toString(),
        targetDate: (row[4] || '').toString(),
        details: (row[5] || '').toString(),
      });
    }
    return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return getAuditLog();
  }
}
