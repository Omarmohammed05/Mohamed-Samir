import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Session } from './auth';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    },
  );
}

export async function getSupabaseSession(): Promise<Session | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = (user.user_metadata?.role as 'user' | 'admin') || 'user';
  const name = (user.user_metadata?.name as string) || user.email || '';
  return { email: user.email || '', role, name };
}
