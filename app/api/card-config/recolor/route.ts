import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { getCardConfig, getDurationColor, formatDuration } from '@/lib/card-config';
import { listAllEntries, updateEntry } from '@/lib/entry-store';
import { google } from 'googleapis';

/** POST — recolor existing Duration cells in the Google Sheet based on current ranges */
export async function POST() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (process.env.SHEETS_MODE !== 'real') {
    return NextResponse.json({ success: true, message: 'Recolor only applies to Google Sheets mode' });
  }

  try {
    const config = await getCardConfig();
    const entries = await listAllEntries();

    // Get sheets client
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID!;

    // Read the CardEntries tab to find Duration column positions
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'CardEntries!A:N',
    });
    const rows = res.data.values || [];

    // Duration is column G (index 6, 0-based) in our layout
    const DURATION_COL = 'G';
    const requests: Record<string, unknown>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const entryId = row[0];
      const cardId = row[1];
      const durationStr = row[6];

      if (!durationStr) continue;
      const durationSeconds = Number(durationStr);
      if (isNaN(durationSeconds)) continue;

      const range = config[cardId];
      if (!range) continue;

      const color = getDurationColor(durationSeconds, range);
      const cellRef = `${DURATION_COL}${i + 1}`;

      if (color === 'high') {
        // Red background
        requests.push({
          updateCells: {
            range: {
              sheetId: undefined, // will be resolved
              startRowIndex: i,
              endRowIndex: i + 1,
              startColumnIndex: 6,
              endColumnIndex: 7,
            },
            fields: 'userEnteredFormat.backgroundColor',
            rows: [{
              values: [{
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 0.4, blue: 0.4 },
                },
              }],
            }],
          },
        });
      } else if (color === 'low') {
        // Yellow/orange background
        requests.push({
          updateCells: {
            range: {
              startRowIndex: i,
              endRowIndex: i + 1,
              startColumnIndex: 6,
              endColumnIndex: 7,
            },
            fields: 'userEnteredFormat.backgroundColor',
            rows: [{
              values: [{
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 0.85, blue: 0.3 },
                },
              }],
            }],
          },
        });
      }
    }

    // Apply cell formatting via batchUpdate if there are requests
    if (requests.length > 0) {
      // Get the sheet ID for CardEntries tab
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const cardEntriesSheet = meta.data.sheets?.find(
        (s) => s.properties?.title === 'CardEntries',
      );
      const tabId = cardEntriesSheet?.properties?.sheetId;
      if (tabId != null) {
        // Add sheetId to each request's range
        for (const req of requests) {
          const uc = req.updateCells as { range: { sheetId?: number } };
          uc.range.sheetId = tabId;
        }
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { requests },
        });
      }
    }

    return NextResponse.json({ success: true, recolored: requests.length });
  } catch (err) {
    console.error('[card-config recolor] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to recolor' }, { status: 500 });
  }
}
