#!/usr/bin/env tsx
/**
 * Reset a user's password in Supabase (admin API).
 * Usage: npm run reset-password -- --email x@y.com --password ...
 */
import { createClient } from '@supabase/supabase-js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return { email: get('--email'), password: get('--password') };
}

async function main() {
  const { email, password } = parseArgs();
  if (!email || !password) {
    console.error('Usage: npm run reset-password -- --email x@y.com --password ...');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false } });

  const { data, error } = await supabase.auth.admin.updateUserByEmail(email, { password });

  if (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }

  console.log(`Password reset for ${data.user.email}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
