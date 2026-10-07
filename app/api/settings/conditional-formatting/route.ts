import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFieldRanges } from '@/lib/field-ranges';
import { applyConditionalFormatting } from '@/lib/conditional-formatting';

/** POST /api/settings/conditional-formatting — apply current ranges as
 *  conditional-formatting rules to the Google Sheet (admin only). */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (process.env.SHEETS_MODE !== 'real') {
    return NextResponse.json(
      { error: 'Conditional formatting only applies in real Google Sheets mode' },
      { status: 400 },
    );
  }

  try {
    const ranges = await getFieldRanges();
    await applyConditionalFormatting(ranges);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to apply conditional formatting' },
      { status: 500 },
    );
  }
}
