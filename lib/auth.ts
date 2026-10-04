import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { MOCK_USERS } from '@/config/mock-users';

export type Session = {
  email: string;
  role: 'user' | 'admin';
  name: string;
};

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-placeholder-secret-change-in-production-3a7f2b8c',
);
const COOKIE_NAME = 'de_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function isMock(): boolean {
  return process.env.AUTH_MODE !== 'supabase';
}

// ─── Mock auth ──────────────────────────────────────────

export async function mockLogin(email: string, password: string): Promise<Session | null> {
  // In real Sheets mode, authenticate against users stored in Google Sheets
  if (process.env.SHEETS_MODE === 'real') {
    const { listUsers } = await import('./users');
    const users = await listUsers();
    const user = users.find(
      (u) => u.email === email.toLowerCase().trim() && u.password === password,
    );
    if (!user) return null;
    return { email: user.email, role: user.role, name: user.name };
  }

  const user = MOCK_USERS.find(
    (u) => u.email === email.toLowerCase().trim() && u.password === password,
  );
  if (!user) return null;
  return { email: user.email, role: user.role, name: user.name };
}

// ─── Session management ─────────────────────────────────

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, role: session.role, name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function getSessionFromToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      email: payload.email as string,
      role: payload.role as 'user' | 'admin',
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

// ─── Server-side session getter (used in RSCs & route handlers) ──

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  if (isMock()) {
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return getSessionFromToken(token);
  }

  // Supabase mode
  const { getSupabaseSession } = await import('./supabase-server');
  return getSupabaseSession();
}

export { COOKIE_NAME, MAX_AGE };

// ─── Rate limiting for login ────────────────────────────

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000; // 1 minute

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.lockedUntil > now) {
    return { allowed: false, retryAfterMs: record.lockedUntil - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  const count = record ? record.count + 1 : 1;
  if (count >= MAX_ATTEMPTS) {
    loginAttempts.set(ip, { count, lockedUntil: now + LOCK_MS });
  } else {
    loginAttempts.set(ip, { count, lockedUntil: 0 });
  }
}

export function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
