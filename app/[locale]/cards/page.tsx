import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { getAllCards } from '@/lib/cards-store';
import { Header } from '@/components/header';
import { CardsGrid } from '@/components/cards-grid';

export default async function CardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  const cards = await getAllCards();

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('cards.title')}</h1>
        <CardsGrid cards={cards} />
      </main>
    </div>
  );
}
