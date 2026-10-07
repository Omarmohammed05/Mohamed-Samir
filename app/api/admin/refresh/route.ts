import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { invalidateAll } from '@/lib/cache';

export async function POST() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  invalidateAll();
  return NextResponse.json({ ok: true });
}
