import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { Header } from '@/components/header';
import { ReviewList } from '@/components/review-list';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  // Only supervisor, engineer, and admin can access the review page
  if (session.role !== 'supervisor' && session.role !== 'engineer' && session.role !== 'admin') {
    redirect(`/${locale}/cards`);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('review.title')}</h1>
        <ReviewList role={session.role} />
      </main>
    </div>
  );
}
