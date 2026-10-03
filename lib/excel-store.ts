import ExcelJS from 'exceljs';
import path from 'path';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { normalizeDate, todayCairo } from './date';
import type { Entry } from './mock-store';

const EXCEL_PATH = process.env.EXCEL_FILE_PATH || path.join(process.cwd(), 'data', 'entries.xlsx');
const SHEET_NAME = 'Entries';
const HEADER = ['Date', 'User', 'A', 'B', 'C', 'D', 'UpdatedAt'];

// Simple mutex — prevents concurrent file writes from corrupting the file
let mutex: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = mutex.then(() => fn());
  mutex = result.then(() => undefined, () => undefined);
  return result as Promise<T>;
}

function cellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result ?? '');
  return String(v);
}

function rowToEntry(row: ExcelJS.Row): Entry | null {
  const date = normalizeDate(cellValue(row.getCell(1)));
  const user = cellValue(row.getCell(2)).toLowerCase().trim();
  if (!date || !user) return null;
  return {
    date,
    user,
    a: cellValue(row.getCell(3)),
    b: cellValue(row.getCell(4)),
    c: cellValue(row.getCell(5)),
    d: cellValue(row.getCell(6)),
    updatedAt: cellValue(row.getCell(7)),
  };
}

async function ensureFile(): Promise<void> {
  if (existsSync(EXCEL_PATH)) return;

  await fs.mkdir(path.dirname(EXCEL_PATH), { recursive: true });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);
  ws.addRow(HEADER);

  // Seed sample data
  const today = todayCairo();
  const y = new Date(today + 'T00:00:00'); y.setDate(y.getDate() - 1); const yd = y.toISOString().slice(0, 10);
  const y2 = new Date(today + 'T00:00:00'); y2.setDate(y2.getDate() - 2); const y2d = y2.toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const seed: string[][] = [
    [today, 'sara@team.com', 'Reviewed Q4 report draft', 'Completed sections 1-3', 'Waiting on finance data', 'Need to sync Monday', now],
    [today, 'omar@team.com', 'Deployed v2.1 to staging', 'All tests passing', 'None', 'Ready for prod Monday', now],
    [yd, 'sara@team.com', 'Client meeting prep', 'Slides done', 'None', '', now],
    [yd, 'omar@team.com', 'Bug triage', 'Fixed 3 issues', 'Need design review on #42', '', now],
    [yd, 'layla@team.com', 'Updated onboarding docs', 'Added 2 new sections', 'None', 'Pushed to repo', now],
    [y2d, 'sara@team.com', 'Team standup notes', 'Discussed roadmap', 'Resource constraints', 'Follow up next week', now],
    [y2d, 'karim@team.com', 'Server maintenance', 'Patched 5 servers', 'None', 'All green', now],
  ];
  for (const row of seed) ws.addRow(row);

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col) => { col.width = 18; });

  await wb.xlsx.writeFile(EXCEL_PATH);
}

export async function listAllExcel(): Promise<{ entries: Entry[]; warnings: string[] }> {
  return withLock(async () => {
    await ensureFile();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) return { entries: [], warnings: [`Sheet "${SHEET_NAME}" not found`] };

    const entries: Entry[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const entry = rowToEntry(row);
      if (!entry) {
        if (rowNum > 1) warnings.push(`Row ${rowNum}: missing date or user`);
        return;
      }
      const key = `${entry.user}|${entry.date}`;
      if (seen.has(key)) {
        warnings.push(`Duplicate row for ${entry.user} on ${entry.date} — showing first`);
        return;
      }
      seen.add(key);
      entries.push(entry);
    });

    entries.sort((a, b) => b.date.localeCompare(a.date));
    return { entries, warnings };
  });
}

export async function listForUserExcel(user: string): Promise<Entry[]> {
  const { entries } = await listAllExcel();
  return entries.filter((e) => e.user === user.toLowerCase());
}

export async function getEntryExcel(user: string, date: string): Promise<Entry | null> {
  const { entries } = await listAllExcel();
  return entries.find((e) => e.user === user.toLowerCase() && e.date === date) || null;
}

export async function upsertEntryExcel(
  user: string,
  date: string,
  data: { a: string; b: string; c: string; d: string },
): Promise<Entry> {
  return withLock(async () => {
    await ensureFile();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`);

    const updatedAt = new Date().toISOString();
    const userLower = user.toLowerCase();

    // Find existing row by (User, Date) key
    let foundRow: ExcelJS.Row | null = null;
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const rowDate = normalizeDate(cellValue(row.getCell(1)));
      const rowUser = cellValue(row.getCell(2)).toLowerCase().trim();
      if (rowDate === date && rowUser === userLower) {
        foundRow = row;
      }
    });

    if (foundRow) {
      foundRow.getCell(3).value = data.a;
      foundRow.getCell(4).value = data.b;
      foundRow.getCell(5).value = data.c;
      foundRow.getCell(6).value = data.d;
      foundRow.getCell(7).value = updatedAt;
    } else {
      const newRow = ws.addRow([date, userLower, data.a, data.b, data.c, data.d, updatedAt]);
      // Re-sort by date descending so newest is at top (optional)
    }

    await wb.xlsx.writeFile(EXCEL_PATH);
    return { date, user: userLower, ...data, updatedAt };
  });
}

export async function deleteEntryExcel(user: string, date: string): Promise<boolean> {
  return withLock(async () => {
    await ensureFile();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) return false;

    const userLower = user.toLowerCase();
    let deleted = false;
    const captured: Entry[] = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1 || deleted) return;
      const rowDate = normalizeDate(cellValue(row.getCell(1)));
      const rowUser = cellValue(row.getCell(2)).toLowerCase().trim();
      if (rowDate === date && rowUser === userLower) {
        // Capture the entry for soft delete
        captured.push({
          date: rowDate, user: rowUser,
          a: cellValue(row.getCell(3)), b: cellValue(row.getCell(4)),
          c: cellValue(row.getCell(5)), d: cellValue(row.getCell(6)),
          updatedAt: cellValue(row.getCell(7)),
        });
        // Clear the row values
        for (let c = 1; c <= 7; c++) row.getCell(c).value = null;
        deleted = true;
      }
    });

    // Soft delete — copy to Deleted sheet
    const deletedEntry = captured[0];
    if (deleted && deletedEntry) {
      const deletedSheetName = 'Deleted';
      let dws = wb.getWorksheet(deletedSheetName);
      if (!dws) {
        dws = wb.addWorksheet(deletedSheetName);
      }
      if (dws) {
        const headerRow = dws.getRow(1);
        if (!headerRow.getCell(1).value) {
          dws.addRow(['Date', 'User', 'A', 'B', 'C', 'D', 'UpdatedAt', 'DeletedAt', 'DeletedBy']);
        }
        dws.addRow([
          deletedEntry.date, deletedEntry.user, deletedEntry.a, deletedEntry.b,
          deletedEntry.c, deletedEntry.d, deletedEntry.updatedAt,
          new Date().toISOString(), 'system',
        ]);
      }
    }

    if (deleted) await wb.xlsx.writeFile(EXCEL_PATH);
    return deleted;
  });
}
