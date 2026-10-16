import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { getCardConfig, getDurationColor } from '@/lib/card-config';
import { listAllEntries } from '@/lib/entry-store';
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
    await listAllEntries(); // ensure the CardEntries tab exists

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID!;

    // Resolve the numeric tab ID so each request carries it directly
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const cardEntriesSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === 'CardEntries',
    );
    const tabId = cardEntriesSheet?.properties?.sheetId;
    if (tabId == null) {
      return NextResponse.json({ success: true, recolored: 0, message: 'CardEntries tab not found' });
    }

    // Read the CardEntries tab: Duration is column G (index 6, 0-based)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'CardEntries!A:N',
    });
    const rows = res.data.values || [];

    const config = await getCardConfig();
    const BACKGROUND_BY_COLOR = {
      high: { red: 1, green: 0.4, blue: 0.4 }, // red — above max
      low: { red: 1, green: 0.85, blue: 0.3 }, // orange — below min
      none: { red: 1, green: 1, blue: 1 }, // default — within range / unconfigured
    } as const;

    const requests: Record<string, unknown>[] = [];
    let recolored = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const cardId = row[1];
      const durationStr = row[6];

      const durationSeconds = Number(durationStr);
      const range = config[cardId];
      const color = durationStr && !isNaN(durationSeconds) && range
        ? getDurationColor(durationSeconds, range)
        : null;
      if (color) recolored++;

      // Every duration cell gets an explicit background so the run is
      // idempotent: cells that were colored under old ranges reset to default.
      requests.push({
        updateCells: {
          range: {
            sheetId: tabId,
            startRowIndex: i,
            endRowIndex: i + 1,
            startColumnIndex: 6,
            endColumnIndex: 7,
          },
          fields: 'userEnteredFormat.backgroundColor',
          rows: [{
            values: [{
              userEnteredFormat: {
                backgroundColor: BACKGROUND_BY_COLOR[color ?? 'none'],
              },
            }],
          }],
        },
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      });
    }

    return NextResponse.json({ success: true, recolored });
  } catch (err) {
    console.error('[card-config recolor] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to recolor' }, { status: 500 });
  }
}
