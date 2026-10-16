import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { Header } from '@/components/header';
import { ChangePassword } from '@/components/change-password';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) {
    const { redirect } = await import('next/navigation');
    redirect(`/${locale}/login`);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-6 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('common.changePassword')}</h2>
          <ChangePassword />
        </div>
      </main>
    </div>
  );
}
