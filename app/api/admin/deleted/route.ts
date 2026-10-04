import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { listDeletedEntries, restoreEntryRow } from '@/lib/sheets';

export async function GET() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const entries = await listDeletedEntries();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { user, date } = body;
  if (!user || !date) {
    return NextResponse.json({ error: 'User and date are required' }, { status: 400 });
  }

  const ok = await restoreEntryRow(user, date, session.email);
  if (!ok) return NextResponse.json({ error: 'Entry not found in deleted store' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
