import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserEntries, upsertEntryRow } from '@/lib/sheets';
import { entryInputSchema } from '@/lib/validators';
import { assertUser } from '@/lib/permissions';

export async function GET() {
  const session = await getSession();
  try {
    assertUser(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Always filter by the authenticated user — ignore any client-supplied user
  const entries = await getUserEntries(session.email);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  try {
    assertUser(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = entryInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  // Strip any user field from the client — always use session email
  const { date, a, b, c, d } = parsed.data;
  try {
    const entry = await upsertEntryRow(session.email, date, { a, b, c, d });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error('[entries POST] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}
