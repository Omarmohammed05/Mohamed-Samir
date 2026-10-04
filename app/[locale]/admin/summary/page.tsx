import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { listEntries } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
import { getCached, setCached } from '@/lib/cache';
import { listUsers } from '@/lib/users';
import { MOCK_USERS } from '@/config/mock-users';
import { Header } from '@/components/header';
import { SummaryReport } from '@/components/summary-report';
import type { Entry } from '@/lib/mock-store';

const ADMIN_CACHE_KEY = 'admin-entries';

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);
  if (session.role !== 'admin') redirect(`/${locale}/entries`);

  let cached = getCached<{ entries: Entry[]; warnings: string[] }>(ADMIN_CACHE_KEY);
  if (!cached) {
    try {
      const result = await listEntries();
      cached = { entries: result.entries, warnings: result.warnings };
      setCached(ADMIN_CACHE_KEY, cached, 10_000);
    } catch {
      cached = { entries: [], warnings: [] };
    }
  }

  const entries = cached?.entries ?? [];
  const sheetsMode = (process.env.SHEETS_MODE || 'excel') as 'mock' | 'excel' | 'real';

  let users: { email: string; name: string; role: 'user' | 'admin' }[] = [];
  if (sheetsMode === 'real') {
    try {
      const allUsers = await listUsers();
      users = allUsers.map((u) => ({ email: u.email, name: u.name, role: u.role }));
    } catch {
      // fallback
    }
  } else {
    users = MOCK_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role }));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Header session={session} />
      </div>
      <SummaryReport
        entries={entries}
        knownUsers={users.map((u) => ({ email: u.email, name: u.name }))}
      />
    </div>
  );
}
