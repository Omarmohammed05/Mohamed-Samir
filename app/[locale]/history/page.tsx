import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Header } from '@/components/header';
import { HistoryList } from '@/components/history-list';

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
        <HistoryList />
      </main>
    </div>
  );
}
