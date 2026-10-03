import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { listEntries } from '@/lib/sheets';
import { getCached, setCached } from '@/lib/cache';
import { todayCairo } from '@/lib/date';
import { MOCK_USERS } from '@/config/mock-users';
import { Header } from '@/components/header';
import { AdminTable } from '@/components/admin-table';

const ADMIN_CACHE_KEY = 'admin-entries';

export default async function AdminPage({
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

  // Short-lived cache (~10s)
  let cached = getCached<{ entries: typeof import('@/lib/mock-store').Entry[]; warnings: string[] }>(ADMIN_CACHE_KEY);
  if (!cached) {
    const result = await listEntries();
    cached = { entries: result.entries, warnings: result.warnings };
    setCached(ADMIN_CACHE_KEY, cached, 10_000);
  }

  const { entries, warnings } = cached;
  const today = todayCairo();
  const knownUserEmails = MOCK_USERS.map((u) => u.email);
  const submittedToday = new Set(entries.filter((e) => e.date === today).map((e) => e.user));
  const notSubmitted = MOCK_USERS
    .filter((u) => u.role === 'user' && !submittedToday.has(u.email))
    .map((u) => ({ email: u.email, name: u.name }));

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`
    : null;
  const sheetsMode = (process.env.SHEETS_MODE || 'excel') as 'mock' | 'excel' | 'real';

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
        <AdminTable
          entries={entries}
          warnings={warnings}
          knownUsers={MOCK_USERS.map((u) => ({ email: u.email, name: u.name }))}
          sheetsMode={sheetsMode}
          sheetUrl={sheetUrl}
          session={session}
          notSubmitted={notSubmitted}
        />
      </main>
    </div>
  );
}
