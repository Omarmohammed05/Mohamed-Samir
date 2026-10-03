import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEntryRow, deleteEntryRow } from '@/lib/sheets';
import { canReadEntry, canDeleteEntry, assertUser } from '@/lib/permissions';

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
  const entry = await getEntryRow(session.email, date);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canDeleteEntry(session, entry.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ok = await deleteEntryRow(session.email, date);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
