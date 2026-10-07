import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConditionalFormatting } from '@/lib/conditional-formatting';

const { getSpreadsheet, batchUpdate } = vi.hoisted(() => ({
  getSpreadsheet: vi.fn(),
  batchUpdate: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: vi.fn() },
    sheets: vi.fn(() => ({
      spreadsheets: { get: getSpreadsheet, batchUpdate },
    })),
  },
}));

const ranges = {
  a: { min: 1, max: 2 },
  b: { min: 1, max: 5 },
  c: { min: 1, max: 3 },
  d: { min: 1, max: 4 },
};

describe('Google Sheets conditional formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SHEETS_MODE', 'real');
    vi.stubEnv('GOOGLE_SHEET_ID', 'test-sheet');
    getSpreadsheet.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'Entries', sheetId: 0 } }] },
    });
    batchUpdate.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sets both background and text colors on all four out-of-range rules', async () => {
    await applyConditionalFormatting(ranges);

    const requests = batchUpdate.mock.calls[0][0].requestBody.requests;
    expect(requests).toHaveLength(4);
    for (const [index, column] of ['C', 'D', 'E', 'F'].entries()) {
      const { min, max } = Object.values(ranges)[index];
      expect(requests[index].addConditionalFormatRule).toEqual({
        index,
        rule: {
          ranges: [{ sheetId: 0, startColumnIndex: index + 2, endColumnIndex: index + 3, startRowIndex: 1 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: `=IFERROR(AND(LEN(TRIM(${column}2&""))>0,OR(VALUE(${column}2)<${min},VALUE(${column}2)>${max})),FALSE)` }],
            },
            format: {
              backgroundColor: { red: 0.996, green: 0.953, blue: 0.780 },
              textFormat: {
                foregroundColor: { red: 146 / 255, green: 64 / 255, blue: 14 / 255 },
              },
            },
          },
        },
      });
    }
  });

  it('does not call Google Sheets outside real mode', async () => {
    vi.stubEnv('SHEETS_MODE', 'mock');
    await applyConditionalFormatting(ranges);
    expect(getSpreadsheet).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});
