import { google } from 'googleapis';
import { nowCairoDateTime } from './date';
import { WARNING_BG, WARNING_FG } from './conditional-formatting';
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

export type CardSheetData = {
  config: Map<string, { min: string; norm: string; max: string }>;
  latestValues: Map<string, string>;
};

/**
 * Reads the matrix-layout sheet and returns config + latest submission values.
 * Matrix layout:
 *   Row 1: Equipment header (names in first column of each group)
 *   Row 2: Tag No.  | tag1 | tag2 | ...
 *   Row 3: Unit     | unit1| unit2| ...
 *   Row 4: Description | desc1 | desc2 | ...
 *   Row 5: Min      | min1 | min2 | ...
 *   Row 6: Norm     | norm1| norm2| ...
 *   Row 7: Max      | max1 | max2 | ...
 *   Row 8: (blank)
 *   Row 9: User | Date | Time | (header for entry section)
 *   Row 10+: submission entries
 */
export async function readCardSheetData(cardId: string): Promise<CardSheetData> {
  const config = new Map<string, { min: string; norm: string; max: string }>();
  const submissions = new Map<string, Map<string, string>>();

  try {
    const allData = await getCardTabData(cardId);
    if (allData.length < 7) return { config, latestValues: new Map() };

    // Read tag numbers from row 2 (index 1), starting from column D (index 3)
    const tagRow = allData[1] || [];
    const tags: string[] = [];
    for (let c = 3; c < tagRow.length; c++) {
      tags.push(tagRow[c] || '');
    }

    // Read config from rows 5-7 (index 4-6): Min, Norm, Max
    const minRow = allData[4] || [];
    const normRow = allData[5] || [];
    const maxRow = allData[6] || [];

    for (let c = 0; c < tags.length; c++) {
      const tagNo = tags[c];
      if (!tagNo) continue;
      config.set(tagNo, {
        min: minRow[c + 3] || '',
        norm: normRow[c + 3] || '',
        max: maxRow[c + 3] || '',
      });
    }

    // Read submissions (rows after User header)
    const userHeaderIdx = allData.findIndex((r) => r[0] === 'User');
    if (userHeaderIdx >= 0) {
      for (let r = userHeaderIdx + 1; r < allData.length; r++) {
        const row = allData[r];
        if (!row || !row[0] || row[0] === 'User') continue;
        const date = row[1] || '';
        const time = row[2] || '';
        const submissionKey = `${date} ${time}`;

        if (!submissions.has(submissionKey)) {
          submissions.set(submissionKey, new Map());
        }

        for (let c = 0; c < tags.length; c++) {
          const tagNo = tags[c];
          if (!tagNo) continue;
          submissions.get(submissionKey)!.set(tagNo, row[c + 3] || '');
        }
      }
    }
  } catch {
    /* tab doesn't exist — return empty maps */
  }

  const sortedDates = Array.from(submissions.keys()).sort().reverse();
  const latestValues = sortedDates.length > 0
    ? submissions.get(sortedDates[0])!
    : new Map<string, string>();

  return { config, latestValues };
}

/**
 * Builds the matrix layout rows from card data.
 * rows: [[equipment, tagNo, unit, description, min, norm, max], ...]
 */
function buildMatrixRows(rows: string[][], submissionRows: string[][]): string[][] {
  // Group by equipment (preserve order)
  const equipmentOrder: string[] = [];
  const equipmentGroups: Map<string, string[][]> = new Map();
  for (const row of rows) {
    const eq = row[0];
    if (!equipmentGroups.has(eq)) {
      equipmentGroups.set(eq, []);
      equipmentOrder.push(eq);
    }
    equipmentGroups.get(eq)!.push(row);
  }

  // Build header rows
  const headerRow: string[] = ['', '', ''];
  const tagNoRow: string[] = ['Tag No.', '', ''];
  const unitRow: string[] = ['Unit', '', ''];
  const descRow: string[] = ['Description', '', ''];
  const minRow: string[] = ['Min', '', ''];
  const normRow: string[] = ['Norm', '', ''];
  const maxRow: string[] = ['Max', '', ''];

  for (const eq of equipmentOrder) {
    const tags = equipmentGroups.get(eq)!;
    headerRow.push(eq);
    for (let i = 1; i < tags.length; i++) headerRow.push('');
    for (const tag of tags) {
      tagNoRow.push(tag[1]);
      unitRow.push(tag[2]);
      descRow.push(tag[3]);
      minRow.push(tag[4]);
      normRow.push(tag[5]);
      maxRow.push(tag[6]);
    }
  }

  const blankRow: string[] = [];
  const totalTags = rows.length;
  const userHeaderRow: string[] = ['User', 'Date', 'Time'];
  while (userHeaderRow.length < 3 + totalTags) userHeaderRow.push('');

  return [
    headerRow, tagNoRow, unitRow, descRow, minRow, normRow, maxRow,
    blankRow, userHeaderRow, ...submissionRows,
  ];
}

/**
 * Saves card config (ranges) in matrix layout.
 * rows: [[equipment, tagNo, unit, description, min, norm, max], ...]
 */
export async function saveCardConfig(cardId: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureTabExists(cardId);

  // Read existing submissions and remap their values by Tag No. so they stay
  // aligned when the tag set changes (e.g. combined A/B tags split apart).
  let submissionRows: string[][] = [];
  try {
    const allData = await getCardTabData(cardId);
    const oldTagRow = allData[1] || [];
    const oldTags: string[] = [];
    for (let c = 3; c < oldTagRow.length; c++) oldTags.push(oldTagRow[c] || '');

    const userHeaderIdx = allData.findIndex((r) => r[0] === 'User');
    if (userHeaderIdx >= 0) {
      for (const r of allData.slice(userHeaderIdx + 1)) {
        if (!r[0]) continue;
        const valuesByTag = new Map<string, string>();
        for (let c = 0; c < oldTags.length; c++) {
          if (oldTags[c]) valuesByTag.set(oldTags[c], r[c + 3] || '');
        }
        const newRow = [r[0], r[1] || '', r[2] || ''];
        for (const row of rows) newRow.push(valuesByTag.get(row[1]) ?? '');
        submissionRows.push(newRow);
      }
    }
  } catch {
    /* no existing data */
  }

  const allRows = buildMatrixRows(rows, submissionRows);

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

/**
 * Saves a process value submission in matrix layout.
 * rows: [[equipment, tagNo, unit, description, min, norm, max, processValue], ...]
 * Appends a new row with user, date, time, and process values for each tag.
 */
export async function saveCardSubmission(
  cardId: string,
  user: string,
  rows: string[][],
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  await ensureTabExists(cardId);

  // Check if the tab's tag columns match the incoming rows; if not, rewrite the
  // matrix layout (existing submissions are remapped by Tag No.)
  let layoutMatches = false;
  try {
    const data = await getCardTabData(cardId);
    if (data.length > 1 && data[1]?.[0] === 'Tag No.') {
      const tagRow = data[1] || [];
      const sheetTags: string[] = [];
      for (let c = 3; c < tagRow.length; c++) sheetTags.push((tagRow[c] || '').trim());
      while (sheetTags.length > 0 && sheetTags[sheetTags.length - 1] === '') sheetTags.pop();
      const clientTags = rows.map((r) => (r[1] || '').trim());
      layoutMatches =
        sheetTags.length === clientTags.length &&
        sheetTags.every((tag, i) => tag === clientTags[i]);
    }
  } catch {
    /* tab is empty */
  }

  if (!layoutMatches) {
    // Write the full matrix layout (existing submissions are preserved)
    const configRows = rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]);
    await saveCardConfig(cardId, configRows);
  }

  // Append the submission row — Date/Time columns are written in Egypt time
  const { date, time } = nowCairoDateTime();

  const entryRow: string[] = [user, date, time];
  for (const row of rows) {
    entryRow.push(row[7] || '');
  }

  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${cardId}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: { values: [entryRow] },
    }),
  );

  await applyCardConditionalFormatting(cardId);
}

/**
 * Applies conditional formatting to highlight out-of-range process values.
 * Process values are in columns D+ (index 3+), rows 10+ (index 9+).
 * Min is in row 5, Max is in row 7 (same column as the process value).
 * Out-of-range cells get the warning palette (pale-yellow background, brown
 * text). Existing rules are removed first so re-applying is idempotent and
 * stale colors never linger.
 */
export async function applyCardConditionalFormatting(cardId: string): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const meta = await withRetry(() =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId }),
  );
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === cardId);
  if (!sheet || sheet.properties?.sheetId === undefined) return;
  const tabId = sheet.properties.sheetId;

  const existingCF = (sheet as unknown as { conditionalFormats?: unknown[] }).conditionalFormats;

  const requests: Record<string, unknown>[] = [];

  // Delete existing conditional-format rules (highest index first)
  if (Array.isArray(existingCF)) {
    for (let i = existingCF.length - 1; i >= 0; i--) {
      requests.push({ deleteConditionalFormatRule: { sheetId: tabId, index: i } });
    }
  }

  requests.push({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{
          sheetId: tabId,
          startColumnIndex: 3,
          startRowIndex: 9,
        }],
        booleanRule: {
          condition: {
            type: 'CUSTOM_FORMULA',
            values: [{
              userEnteredValue:
                '=AND(D10<>"",ISNUMBER(VALUE(D10)),OR(AND(D$5<>"",ISNUMBER(VALUE(D$5)),VALUE(D10)<VALUE(D$5)),AND(D$7<>"",ISNUMBER(VALUE(D$7)),VALUE(D10)>VALUE(D$7))))',
            }],
          },
          format: {
            backgroundColor: WARNING_BG,
            textFormat: { foregroundColor: WARNING_FG },
          },
        },
      },
    },
  });

  await withRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    }),
  );
}
