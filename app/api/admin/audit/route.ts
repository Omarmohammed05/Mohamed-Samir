import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { listAuditFromSheet } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const records = await listAuditFromSheet();
  return NextResponse.json({ records });
}
