/**
 * Google Sheets conditional formatting — mirrors the admin-table UI's
 * out-of-range highlighting. Cells in the Entries tab turn orange (#FFFBE6)
 * when their numeric value falls outside the configured field range.
 *
 * Columns in the Entries tab:
 *   C = Task (a), D = Progress (b), E = Blockers (c), F = Notes (d)
 *
 * Conditional-formatting custom formulas use ISNUMBER + comparison against
 * the range bounds. Blank or non-numeric cells are never highlighted.
 */
import { google } from 'googleapis';
import type { FieldRanges } from './field-ranges';
import { FIELDS } from '@/config/fields';

/** Map field keys to their column letter in the Entries sheet. */
const FIELD_COLUMN: Record<string, string> = { a: 'C', b: 'D', c: 'E', d: 'F' };

/** Orange background matching the UI's amber highlight. */
const ORANGE_BG = { red: 1, green: 0.984, blue: 0.902 }; // #FFFBE6

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

/**
 * Apply (or refresh) conditional-formatting rules on the Entries tab so that
 * out-of-range numeric cells get an orange background. Removes any existing
 * rules on the data columns first, then adds the new ones.
 *
 * Only runs in real mode (SHEETS_MODE=real). No-op otherwise.
 */
export async function applyConditionalFormatting(ranges: FieldRanges): Promise<void> {
  if (process.env.SHEETS_MODE !== 'real') return;

  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  // Get the sheet ID (numeric) for the "Entries" tab
  const meta = await withRetry(() =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId }),
  );
  const entriesSheet = meta.data.sheets?.find(
    (s) => s.properties?.title === 'Entries',
  );
  const tabId = entriesSheet?.properties?.sheetId;
  if (tabId == null) return;

  // The Sheets API returns conditional formatting in spreadsheet metadata
  // under `conditionalFormats` per sheet
  const existingCF = (entriesSheet as unknown as { conditionalFormats?: unknown[] }).conditionalFormats;
  const ruleIndices: number[] = [];
  if (Array.isArray(existingCF)) {
    existingCF.forEach((_, idx) => ruleIndices.push(idx));
  }

  // Build new rules — one per field column
  const newRules = FIELDS.filter((f) => ranges[f.key]).map((f) => {
    const col = FIELD_COLUMN[f.key];
    const { min, max } = ranges[f.key];
    // Formula: highlight when cell is a number AND (value < min OR value > max)
    const formula = `=AND(ISNUMBER(${col}2),OR(${col}2<${min},${col}2>${max}))`;
    return {
      ranges: [{ sheetId: tabId, startColumnIndex: col.charCodeAt(0) - 65, endColumnIndex: col.charCodeAt(0) - 65 + 1, startRowIndex: 1 }],
      booleanRule: {
        condition: { type: 'CUSTOM_FORMULA' as const, values: [{ userEnteredValue: formula }] },
        format: { backgroundColor: ORANGE_BG },
      },
    };
  });

  // Clear existing rules then add new ones via batchUpdate
  const requests: Record<string, unknown>[] = [];

  // Delete existing conditional-format rules (from highest index to lowest to avoid shifting)
  for (let i = ruleIndices.length - 1; i >= 0; i--) {
    requests.push({
      deleteConditionalFormatRule: { sheetId: tabId, index: ruleIndices[i] },
    });
  }

  // Add new rules
  for (const rule of newRules) {
    requests.push({
      addConditionalFormatRule: { rule, index: 0 },
    });
  }

  if (requests.length === 0) return;

  await withRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    }),
  );
}
