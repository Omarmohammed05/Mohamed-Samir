import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST() {
  const isMock = process.env.AUTH_MODE !== 'supabase';

  if (!isMock) {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
