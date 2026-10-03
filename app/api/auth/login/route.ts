import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validators';
import { mockLogin, createSessionToken, checkRateLimit, recordFailedAttempt, clearRateLimit, COOKIE_NAME, MAX_AGE } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const isMock = process.env.AUTH_MODE !== 'supabase';

  if (isMock) {
    const session = await mockLogin(parsed.data.email, parsed.data.password);
    if (!session) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    clearRateLimit(ip);
    const token = await createSessionToken(session);
    const res = NextResponse.json({ role: session.role });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
    });
    return res;
  }

  // Supabase mode
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  clearRateLimit(ip);
  const role = (data.user.user_metadata?.role as string) || 'user';
  return NextResponse.json({ role });
}
