import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { getUserEntries, getEntryRow } from '@/lib/sheets';
import { todayCairo } from '@/lib/date';
import { Header } from '@/components/header';
import { EntryForm } from '@/components/entry-form';
import { EntriesList } from '@/components/entries-list';
import type { Entry } from '@/lib/mock-store';

export default async function EntriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);
  if (session.role === 'admin') redirect(`/${locale}/admin`);

  const today = todayCairo();
  let entries: Entry[] = [];
  let todayEntry: Entry | null = null;
  let sheetsError: string | null = null;
  try {
    entries = await getUserEntries(session.email) as Entry[];
    todayEntry = (await getEntryRow(session.email, today)) as Entry | null;
  } catch (err) {
    sheetsError = err instanceof Error ? err.message : 'Failed to connect to Google Sheets';
  }

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('entries.title')}</h1>
        {sheetsError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 flex flex-col gap-2">
            <p className="font-medium text-sm text-destructive">Google Sheets connection error</p>
            <p className="text-sm text-muted-foreground">{sheetsError}</p>
            <p className="text-sm text-muted-foreground">
              Make sure the Google Sheets API is enabled in your Google Cloud project and your service account has access to the spreadsheet.
            </p>
          </div>
        )}
        <EntryForm
          todayDate={today}
          existingEntry={todayEntry as Entry | null}
        />
        <EntriesList initialEntries={entries} todayDate={today} />
      </main>
    </div>
  );
}
