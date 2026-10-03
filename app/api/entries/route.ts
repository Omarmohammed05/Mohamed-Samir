import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserEntries, upsertEntryRow } from '@/lib/sheets';
import { entryInputSchema } from '@/lib/validators';
import { assertUser, canWriteEntry, isAdmin } from '@/lib/permissions';
import { canEditDate } from '@/lib/settings';

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

  const { date, a, b, c, d } = parsed.data;
  // Admin can specify a target user; regular users always write as themselves
  const targetUser = session.role === 'admin' && body.user
    ? String(body.user).toLowerCase()
    : session.email;
  if (!canWriteEntry(session, targetUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Late-entry rule: regular users can only edit within the last 7 days
  if (!canEditDate(date, isAdmin(session))) {
    return NextResponse.json(
      { error: 'This entry is outside the editable window. Only entries from the last 7 days can be edited.' },
      { status: 403 },
    );
  }

  try {
    const entry = await upsertEntryRow(targetUser, date, { a, b, c, d }, session.email);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error('[entries POST] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}
