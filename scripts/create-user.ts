#!/usr/bin/env tsx
/**
 * Create a user in Supabase (admin API).
 * Usage: npm run create-user -- --email x@y.com --name "Name" --role user|admin --password ...
 */
import { createClient } from '@supabase/supabase-js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    email: get('--email'),
    name: get('--name'),
    role: get('--role') as 'user' | 'admin' | undefined,
    password: get('--password'),
  };
}

async function main() {
  const { email, name, role, password } = parseArgs();
  if (!email || !name || !role || !password) {
    console.error('Usage: npm run create-user -- --email x@y.com --name "Name" --role user|admin --password ...');
    process.exit(1);
  }
  if (role !== 'user' && role !== 'admin') {
    console.error('Role must be "user" or "admin"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false } });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name, role },
    email_confirm: true,
  });

  if (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }

  console.log(`Created ${role}: ${data.user.email} (id: ${data.user.id})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
