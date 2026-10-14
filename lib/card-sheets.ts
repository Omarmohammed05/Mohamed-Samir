import { google } from 'googleapis';
import { CARD_TABS } from '@/config/cards';

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
 * Ensures all 26 tabs (F01–F26) exist in the spreadsheet.
 * Returns the list of created and already-existing tab names.
 */
export async function ensureCardTabs(): Promise<{
  created: string[];
  existing: string[];
}> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const meta = await withRetry(() =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId }),
  );
  const existingTitles = new Set(
    (meta.data.sheets || []).map((s) => s.properties?.title || ''),
  );

  const created: string[] = [];
  const existing: string[] = [];
  const requests: { addSheet: { properties: { title: string } } }[] = [];

  for (const tab of CARD_TABS) {
    if (existingTitles.has(tab)) {
      existing.push(tab);
    } else {
      created.push(tab);
      requests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (requests.length > 0) {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      }),
    );
  }

  return { created, existing };
}

/**
 * Reads all rows from a card tab.
 */
export async function getCardTabData(tabName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!A:Z` }),
  );
  return (res.data.values || []) as string[][];
}

/**
 * Saves card data rows to a card tab in Google Sheets.
 * Creates the tab if it doesn't exist yet.
 */
export async function saveCardData(cardId: string, dataRows: string[][]): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const header = ['Equipment', 'Tag No.', 'Unit', 'Description', 'Min', 'Norm', 'Max', 'Value'];
  const allRows = [header, ...dataRows];

  // Try to clear the tab; create it if it doesn't exist
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${cardId}!A:Z`,
      }),
    );
  } catch {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: cardId } } }] },
      }),
    );
  }

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${cardId}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: allRows },
    }),
  );
}
