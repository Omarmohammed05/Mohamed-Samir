import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEntryRow, deleteEntryRow } from '@/lib/sheets';
import { canReadEntry, canDeleteEntry, assertUser, isAdmin } from '@/lib/permissions';
import { canEditDate } from '@/lib/settings';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await getSession();
  try {
    assertUser(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await params;
  const entry = await getEntryRow(session.email, date);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canReadEntry(session, entry.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ entry });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await getSession();
  try {
    assertUser(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await params;
  // Admin can specify a target user via query param; regular users delete their own
  const targetUser = isAdmin(session) && req.nextUrl.searchParams.get('user')
    ? req.nextUrl.searchParams.get('user')!.toLowerCase()
    : session.email;
  const entry = await getEntryRow(targetUser, date);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canDeleteEntry(session, entry.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Late-entry rule: regular users can only delete within the last 7 days
  if (!canEditDate(date, isAdmin(session))) {
    return NextResponse.json(
      { error: 'This entry is outside the editable window. Only entries from the last 7 days can be deleted.' },
      { status: 403 },
    );
  }
  const ok = await deleteEntryRow(targetUser, date, session.email);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
