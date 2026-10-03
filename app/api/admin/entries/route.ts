import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listEntries } from '@/lib/sheets';
import { getCached, setCached } from '@/lib/cache';
import { assertAdmin } from '@/lib/permissions';

const ADMIN_CACHE_KEY = 'admin-entries';

export async function GET() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let cached = getCached<{ entries: ReturnType<typeof listEntries> extends Promise<{ entries: infer T }> ? T : never; warnings: string[] }>(ADMIN_CACHE_KEY);
  if (!cached) {
    const result = await listEntries();
    cached = { entries: result.entries, warnings: result.warnings } as any;
    setCached(ADMIN_CACHE_KEY, cached, 10_000);
  }

  return NextResponse.json(cached);
}
