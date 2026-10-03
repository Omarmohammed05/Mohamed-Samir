import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, name, missingDates } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // No actual email service — log and return success
  console.log(`[reminder] Admin ${session.email} sent reminder to ${name || email} for missing dates: ${JSON.stringify(missingDates || [])}`);

  return NextResponse.json({ ok: true, message: `Reminder noted for ${name || email}` });
}
