'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const t = useTranslations('errors');
  const pathname = usePathname();
  const locale = pathname?.startsWith('/ar') ? 'ar' : 'en';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-xl font-semibold">{t('404title')}</h2>
        <p className="text-sm text-muted-foreground">{t('404description')}</p>
        <a href={`/${locale}`}>
          <Button variant="outline">{t('goHome')}</Button>
        </a>
      </div>
    </div>
  );
}
