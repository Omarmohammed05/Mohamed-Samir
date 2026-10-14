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

const CARD_SHEET_HEADER = ['Date', 'User', 'Equipment', 'Tag No.', 'Unit', 'Description', 'Min', 'Norm', 'Max', 'ProcessValue'];

async function ensureTabExists(tabName: string): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  try {
    await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!A1:A1` }),
    );
  } catch {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
      }),
    );
  }
}

async function ensureHeader(tabName: string): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  try {
    const res = await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!A1:J1` }),
    );
    if (res.data.values && res.data.values.length > 0) return;
  } catch { /* tab might not exist yet */ }
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CARD_SHEET_HEADER] },
    }),
  );
}

export type CardSheetData = {
  config: Map<string, { min: string; norm: string; max: string }>;
  latestValues: Map<string, string>;
};

export async function readCardSheetData(cardId: string): Promise<CardSheetData> {
  const config = new Map<string, { min: string; norm: string; max: string }>();
  const submissions = new Map<string, Map<string, string>>();

  try {
    const allData = await getCardTabData(cardId);
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      if (!row || row.length === 0) continue;
      const date = row[0] || '';
      const equipment = row[2] || '';
      const tagNo = row[3] || '';
      const key = `${equipment}|${tagNo}`;
      if (date === 'CONFIG') {
        config.set(key, { min: row[6] || '', norm: row[7] || '', max: row[8] || '' });
      } else if (date) {
        if (!submissions.has(date)) submissions.set(date, new Map());
        submissions.get(date)!.set(key, row[9] || '');
      }
    }
  } catch { /* tab doesn't exist — return empty maps */ }

  const sortedDates = Array.from(submissions.keys()).sort().reverse();
  const latestValues = sortedDates.length > 0
    ? submissions.get(sortedDates[0])!
    : new Map<string, string>();

  return { config, latestValues };
}

export async function saveCardSubmission(
  cardId: string,
  user: string,
  rows: string[][],
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureTabExists(cardId);
  await ensureHeader(cardId);

  const now = new Date().toISOString();
  const dataRows = rows.map((row) => [now, user, ...row]);

  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${cardId}!A:J`,
      valueInputOption: 'RAW',
      requestBody: { values: dataRows },
    }),
  );

  await applyCardConditionalFormatting(cardId);
}

export async function saveCardConfig(cardId: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureTabExists(cardId);
  await ensureHeader(cardId);

  // Read existing data to preserve submissions
  let submissionRows: string[][] = [];
  try {
    const allData = await getCardTabData(cardId);
    submissionRows = allData.slice(1).filter((row) => row[0] && row[0] !== 'CONFIG');
  } catch { /* no existing data */ }

  const configRows = rows.map((row) => ['CONFIG', '', ...row, '']);
  const allRows = [CARD_SHEET_HEADER, ...configRows, ...submissionRows];

  await withRetry(() =>
    sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `${cardId}!A:Z` }),
  );
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${cardId}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: allRows },
    }),
  );
}

async function applyCardConditionalFormatting(cardId: string): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const meta = await withRetry(() =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId }),
  );
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === cardId);
  if (!sheet || sheet.properties?.sheetId === undefined) return;
  const tabId = sheet.properties.sheetId;

  await withRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          addConditionalFormatRule: {
            index: 0,
            rule: {
              ranges: [{ sheetId: tabId, startColumnIndex: 9, startRowIndex: 1 }],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{
                    userEnteredValue:
                      '=AND(J2<>"",ISNUMBER(VALUE(J2)),OR(AND(G2<>"",ISNUMBER(VALUE(G2)),VALUE(J2)<VALUE(G2)),AND(I2<>"",ISNUMBER(VALUE(I2)),VALUE(J2)>VALUE(I2))))',
                  }],
                },
                format: {
                  backgroundColor: { red: 1, green: 0.65, blue: 0 },
                  textFormat: { foregroundColor: { red: 0.55, green: 0.27, blue: 0 } },
                },
              },
            },
          },
        }],
      },
    }),
  );
}
