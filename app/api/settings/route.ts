import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFieldRanges, saveFieldRanges, validateRanges } from '@/lib/field-ranges';
import { applyConditionalFormatting } from '@/lib/conditional-formatting';

/** Any authenticated user can read ranges (needed by the entry form). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ranges = await getFieldRanges();
  return NextResponse.json({ ranges });
}

/** Only admins can update ranges. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    const cleaned = validateRanges(body.ranges);
    await saveFieldRanges(cleaned);
    // Sync conditional formatting to the Google Sheet so out-of-range cells
    // turn orange — mirrors the admin-table UI highlighting.
    try {
      await applyConditionalFormatting(cleaned);
    } catch (err) {
      console.error('[settings] Failed to sync conditional formatting:', err instanceof Error ? err.message : 'unknown');
    }
    return NextResponse.json({ ranges: cleaned });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid ranges' },
      { status: 400 },
    );
  }
}
