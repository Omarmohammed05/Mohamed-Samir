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
  const entries = await getUserEntries(session.email);
  const todayEntry = await getEntryRow(session.email, today);

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('entries.title')}</h1>
        <EntryForm
          todayDate={today}
          existingEntry={todayEntry as Entry | null}
          onSaved={() => {}}
        />
        <EntriesList initialEntries={entries as Entry[]} todayDate={today} />
      </main>
    </div>
  );
}
