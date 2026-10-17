import { google } from 'googleapis';
import { nowCairoDateTime } from './date';
import { WARNING_BG, WARNING_FG } from './conditional-formatting';
import { CARD_TABS } from '@/config/cards';

/**
 * Metadata columns that precede process values in the matrix layout:
 *   User, Date, Time, Duration, Engineer, Supervisor
 * Process values start at the column after these (column G / index 6).
 */
const META_COLS = 6;
const META_HEADERS = ['User', 'Date', 'Time', 'Duration', 'Engineer', 'Supervisor'];

/**
 * Detects whether an existing sheet uses the old 3-column metadata layout
 * (User, Date, Time) or the new 6-column layout (adds Duration, Engineer,
 * Supervisor). Falls back to the old offset for sheets written before the
 * extra columns existed.
 */
function detectColOffset(allData: string[][]): number {
  const userHeaderIdx = allData.findIndex((r) => r[0] === 'User');
  if (userHeaderIdx >= 0 && allData[userHeaderIdx]?.[3] === 'Duration') return META_COLS;
  return 3;
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
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!A:ZZ` }),
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

export type SheetContainer = {
  equipment: string;
  tagNo: string;
  unit: string;
  description: string;
  min: string;
  norm: string;
  max: string;
  hidden: boolean;
};

export type CardSheetData = {
  config: Map<string, { min: string; norm: string; max: string; hidden: boolean }>;
  /** Full container layout read from the sheet (source of truth when non-empty) */
  containers: SheetContainer[];
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
 *   Row 9: User | Date | Time | Duration | Engineer | Supervisor | (values header) | Filter
 *   Row 10+: submission entries
 */
export async function readCardSheetData(cardId: string): Promise<CardSheetData> {
  const config = new Map<string, { min: string; norm: string; max: string; hidden: boolean }>();
  const containers: SheetContainer[] = [];
  const submissions = new Map<string, Map<string, string>>();

  try {
    const allData = await getCardTabData(cardId);
    if (allData.length < 7) return { config, containers, latestValues: new Map() };

    // Detect old (3-col) vs new (6-col) metadata layout
    const colOffset = detectColOffset(allData);

    // Read tag numbers from row 2 (index 1), starting at the detected offset
    const tagRow = allData[1] || [];
    const tags: string[] = [];
    for (let c = colOffset; c < tagRow.length; c++) {
      tags.push(tagRow[c] || '');
    }

    // Read equipment groups from the header row (index 0). The equipment name
    // sits in the first column of each group; the rest are blank.
    const headerRow = allData[0] || [];
    // Read config from rows 5-7 (index 4-6): Min, Norm, Max
    const unitRow = allData[2] || [];
    const descRow = allData[3] || [];
    const minRow = allData[4] || [];
    const normRow = allData[5] || [];
    const maxRow = allData[6] || [];
    // Hidden flags live in row 8 (index 7) — blank on older sheets
    const hiddenRow = allData[7] || [];

    let currentEquipment = '';
    for (let c = 0; c < tags.length; c++) {
      const tagNo = tags[c];
      if (!tagNo) continue;
      const col = c + colOffset;
      const eq = headerRow[col] || '';
      if (eq) currentEquipment = eq;
      const min = minRow[col] || '';
      const norm = normRow[col] || '';
      const max = maxRow[col] || '';
      const hidden = (hiddenRow[col] || '').trim() === '1';
      config.set(tagNo, { min, norm, max, hidden });
      containers.push({
        equipment: currentEquipment,
        tagNo,
        unit: unitRow[col] || '',
        description: descRow[col] || '',
        min,
        norm,
        max,
        hidden,
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
          submissions.get(submissionKey)!.set(tagNo, row[c + colOffset] || '');
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

  return { config, containers, latestValues };
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

  // Build header rows — META_COLS blank columns precede the tag columns
  const blanks = Array(META_COLS).fill('');
  const headerRow: string[] = [...blanks];
  const tagNoRow: string[] = ['Tag No.', ...Array(META_COLS - 1).fill('')];
  const unitRow: string[] = ['Unit', ...Array(META_COLS - 1).fill('')];
  const descRow: string[] = ['Description', ...Array(META_COLS - 1).fill('')];
  const minRow: string[] = ['Min', ...Array(META_COLS - 1).fill('')];
  const normRow: string[] = ['Norm', ...Array(META_COLS - 1).fill('')];
  const maxRow: string[] = ['Max', ...Array(META_COLS - 1).fill('')];
  // Hidden markers: '1' under a tag column means that container is hidden.
  // Occupies the row between Max and the User header (blank on older sheets).
  const hiddenRow: string[] = ['Hidden', ...Array(META_COLS - 1).fill('')];

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
      hiddenRow.push(tag[7] === '1' ? '1' : '');
    }
  }

  const totalTags = rows.length;
  // 'Filter' records which A/B checkboxes were checked for each submission
  const userHeaderRow: string[] = [...META_HEADERS];
  while (userHeaderRow.length < META_COLS + totalTags) userHeaderRow.push('');
  userHeaderRow.push('Filter');

  return [
    headerRow, tagNoRow, unitRow, descRow, minRow, normRow, maxRow,
    hiddenRow, userHeaderRow, ...submissionRows,
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
  // Existing hidden flags — preserved when the incoming rows don't carry them
  const oldHiddenByTag = new Map<string, boolean>();
  // Previous extent of the written area — used to pad the atomic update below
  let oldRows = 0;
  let oldCols = 0;
  try {
    const allData = await getCardTabData(cardId);
    oldRows = allData.length;
    for (const r of allData) oldCols = Math.max(oldCols, r.length);
    const oldColOffset = detectColOffset(allData);
    const oldTagRow = allData[1] || [];
    const oldTags: string[] = [];
    for (let c = oldColOffset; c < oldTagRow.length; c++) oldTags.push(oldTagRow[c] || '');

    const oldHiddenRow = allData[7] || [];
    for (let c = 0; c < oldTags.length; c++) {
      if (oldTags[c]) oldHiddenByTag.set(oldTags[c], (oldHiddenRow[c + oldColOffset] || '').trim() === '1');
    }

    const userHeaderIdx = allData.findIndex((r) => r[0] === 'User');
    if (userHeaderIdx >= 0) {
      // Trim trailing blank tag columns to locate the old Filter cell
      const oldTagCount = [...oldTags].reduce(
        (n, t, i) => (t ? i + 1 : n),
        0,
      );
      for (const r of allData.slice(userHeaderIdx + 1)) {
        if (!r[0]) continue;
        const valuesByTag = new Map<string, string>();
        for (let c = 0; c < oldTags.length; c++) {
          if (oldTags[c]) valuesByTag.set(oldTags[c], r[c + oldColOffset] || '');
        }
        // New layout: User, Date, Time, Duration, Engineer, Supervisor, ...values, Filter
        const newRow = [r[0], r[1] || '', r[2] || '', '', '', ''];
        for (const row of rows) newRow.push(valuesByTag.get(row[1]) ?? '');
        newRow.push(r[oldColOffset + oldTagCount] || ''); // Filter cell
        submissionRows.push(newRow);
      }
    }
  } catch {
    /* no existing data */
  }

  // Rows from Save Ranges carry the hidden flag at index 7; rows rewritten
  // during a submission don't — fill those from the sheet's existing flags.
  const rowsWithHidden = rows.map((r) =>
    r.length > 7 ? r : [...r, oldHiddenByTag.get(String(r[1])) ? '1' : ''],
  );

  const allRows = buildMatrixRows(rowsWithHidden, submissionRows);

  // Remove leftover merged cells from the original hand-made sheet — merges in
  // the header row silently swallow the equipment group labels written by the
  // rewrite, which makes containers reappear under a "Custom" tab in the app.
  try {
    const meta = await withRetry(() =>
      sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets(properties.title,merges)',
      }),
    );
    const merges =
      meta.data.sheets?.find((s) => s.properties?.title === cardId)?.merges || [];
    if (merges.length > 0) {
      await withRetry(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: merges.map((range) => ({ unmergeCells: { range } })),
          },
        }),
      );
    }
  } catch {
    /* best-effort — the rewrite below still works without it */
  }

  // Single atomic update — no clear-then-write gap. The old clear+update pair
  // left an empty window mid-save during which page loads read an empty sheet
  // and fell back to the default layout, making saved containers vanish.
  // Padding to the previous extent blanks stale cells within the same write.
  const width = allRows.reduce((w, r) => Math.max(w, r.length), oldCols);
  const padded = allRows.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill('')]);
  while (padded.length < oldRows) padded.push(Array(width).fill(''));
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${cardId}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: padded },
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
  filter = '',
  duration = '',
  userName = '',
  supervisor = '',
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
      const colOffset = detectColOffset(data);
      // Old 3-column layout (User, Date, Time only) — force a rebuild so the
      // Duration / Engineer / Supervisor columns are added to the header.
      if (colOffset === META_COLS) {
        const tagRow = data[1] || [];
        const sheetTags: string[] = [];
        for (let c = colOffset; c < tagRow.length; c++) sheetTags.push((tagRow[c] || '').trim());
        while (sheetTags.length > 0 && sheetTags[sheetTags.length - 1] === '') sheetTags.pop();
        const clientTags = rows.map((r) => (r[1] || '').trim());
        layoutMatches =
          sheetTags.length === clientTags.length &&
          sheetTags.every((tag, i) => tag === clientTags[i]);
      }
    }
  } catch {
    /* tab is empty */
  }

  if (!layoutMatches) {
    // Write the full matrix layout (existing submissions are preserved)
    const configRows = rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]);
    await saveCardConfig(cardId, configRows);
  }

  // Append the submission row — Date/Time columns are written in Egypt time.
  // The row is written explicitly after the last submission rather than via
  // values.append, whose table detection misplaces rows on this matrix layout.
  const { date, time } = nowCairoDateTime();
  const displayName = userName || user;

  // Layout: User (name), Date, Time, Duration, Engineer, Supervisor, ...values, Filter
  // Engineer and Supervisor are left blank on submission — they are filled in
  // when the respective reviewer approves (updateCardSubmissionReview).
  const entryRow: string[] = [displayName, date, time, duration, '', ''];
  for (const row of rows) {
    entryRow.push(row[7] || '');
  }
  entryRow.push(filter);

  let nextRow = 10; // default: first row after the header block
  try {
    const data = await getCardTabData(cardId);
    const userHeaderIdx = data.findIndex((r) => r[0] === 'User');
    if (userHeaderIdx >= 0) {
      let last = userHeaderIdx;
      for (let i = userHeaderIdx + 1; i < data.length; i++) {
        if (data[i]?.[0]) last = i;
      }
      nextRow = last + 2; // 0-based index -> 1-based row after it
    }
  } catch {
    /* keep default */
  }

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${cardId}!A${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [entryRow] },
    }),
  );

  await applyCardConditionalFormatting(cardId);
}

/**
 * Applies conditional formatting to highlight out-of-range process values.
 * Process values are in columns G+ (index 6+), rows 10+ (index 9+).
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

  // Process values start at column index META_COLS (column G). The formula
  // uses the corresponding column letter for the first value column.
  const colLetter = String.fromCharCode(65 + META_COLS); // 'G'

  requests.push({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{
          sheetId: tabId,
          startColumnIndex: META_COLS,
          startRowIndex: 9,
        }],
        booleanRule: {
          condition: {
            type: 'CUSTOM_FORMULA',
            values: [{
              userEnteredValue:
                `=AND(${colLetter}10<>"",ISNUMBER(VALUE(${colLetter}10)),OR(AND(${colLetter}$5<>"",ISNUMBER(VALUE(${colLetter}$5)),VALUE(${colLetter}10)<VALUE(${colLetter}$5)),AND(${colLetter}$7<>"",ISNUMBER(VALUE(${colLetter}$7)),VALUE(${colLetter}10)>VALUE(${colLetter}$7))))`,
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

/**
 * Updates the Supervisor or Engineer column of a submission row in a card tab
 * after the respective reviewer approves. The row is identified by the
 * operator's display name and the submission date (optionally the time for an
 * exact match). Only the 6-column metadata layout is supported; old 3-column
 * sheets are skipped (they are rebuilt on the next submission).
 */
export async function updateCardSubmissionReview(
  cardId: string,
  operatorName: string,
  createdAt: string,
  reviewerName: string,
  role: 'supervisor' | 'engineer',
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID!;

  const data = await getCardTabData(cardId);
  const colOffset = detectColOffset(data);
  if (colOffset !== META_COLS) return; // old layout — skip

  const userHeaderIdx = data.findIndex((r) => r[0] === 'User');
  if (userHeaderIdx < 0) return;

  const { date, time } = nowCairoDateTime(new Date(createdAt));

  // Try an exact match (operator name + date + time), then fall back to the
  // last row matching operator name + date.
  let matchIdx = -1;
  let fallbackIdx = -1;
  for (let i = userHeaderIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || row[0] === 'User') continue;
    if (row[0] === operatorName && row[1] === date) {
      fallbackIdx = i;
      if (row[2] === time) {
        matchIdx = i;
        break;
      }
    }
  }
  const targetIdx = matchIdx >= 0 ? matchIdx : fallbackIdx;
  if (targetIdx < 0) return;

  // Supervisor = column F (index 5), Engineer = column E (index 4)
  const colIndex = role === 'supervisor' ? 5 : 4;
  const colLetter = String.fromCharCode(65 + colIndex);
  const rowNum = targetIdx + 1; // 1-based

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${cardId}!${colLetter}${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[reviewerName]] },
    }),
  );
}
