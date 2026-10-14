import { redirect, notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { getCard } from '@/lib/cards-store';
import { CARD_CODES } from '@/lib/cards-types';
import { Header } from '@/components/header';
import { CardDetail } from '@/components/card-detail';

export function generateStaticParams() {
  return CARD_CODES.map((code) => ({ code }));
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  const card = await getCard(code);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="sr-only">{t('cards.title')}</h1>
        <CardDetail card={card} />
      </main>
    </div>
  );
}
