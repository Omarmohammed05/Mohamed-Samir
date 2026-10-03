import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { listEntries } from '@/lib/sheets';
import { getCached, setCached } from '@/lib/cache';
import { todayCairo } from '@/lib/date';
import { MOCK_USERS } from '@/config/mock-users';
import { Header } from '@/components/header';
import { AdminTable } from '@/components/admin-table';
import { listUsers } from '@/lib/users';
import { UserManager } from '@/components/user-manager';

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
  let sheetsError: string | null = null;
  if (!cached) {
    try {
      const result = await listEntries();
      cached = { entries: result.entries, warnings: result.warnings };
      setCached(ADMIN_CACHE_KEY, cached, 10_000);
    } catch (err) {
      sheetsError = err instanceof Error ? err.message : 'Failed to connect to Google Sheets';
    }
  }

  const entries = cached?.entries ?? [];
  const warnings = cached?.warnings ?? [];
  const sheetsMode = (process.env.SHEETS_MODE || 'excel') as 'mock' | 'excel' | 'real';

  // Fetch users — dynamic from Google Sheets in real mode, mock otherwise
  let users: { email: string; name: string; role: 'user' | 'admin' }[] = [];
  if (sheetsMode === 'real') {
    try {
      const allUsers = await listUsers();
      users = allUsers.map((u) => ({ email: u.email, name: u.name, role: u.role }));
    } catch {
      // Users sheet might not exist yet — UserManager will show the notice
    }
  } else {
    users = MOCK_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role }));
  }

  const today = todayCairo();
  const submittedToday = new Set(entries.filter((e) => e.date === today).map((e) => e.user));
  const notSubmitted = users
    .filter((u) => u.role === 'user' && !submittedToday.has(u.email))
    .map((u) => ({ email: u.email, name: u.name }));

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
        {sheetsError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 flex flex-col gap-2">
            <p className="font-medium text-sm text-destructive">Google Sheets connection error</p>
            <p className="text-sm text-muted-foreground">{sheetsError}</p>
            <p className="text-sm text-muted-foreground">
              Make sure the Google Sheets API is enabled in your Google Cloud project and your service account has access to the spreadsheet.
            </p>
          </div>
        )}
        <AdminTable
          entries={entries}
          warnings={warnings}
          knownUsers={users.map((u) => ({ email: u.email, name: u.name }))}
          sheetsMode={sheetsMode}
          sheetUrl={sheetUrl}
          session={session}
          notSubmitted={notSubmitted}
        />
        <UserManager users={users} sheetsMode={sheetsMode} />
      </main>
    </div>
  );
}
