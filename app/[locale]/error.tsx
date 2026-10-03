'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  void error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">{t('500title')}</h1>
        <p className="text-sm text-muted-foreground">{t('500description')}</p>
        <div className="flex gap-2">
          <Button onClick={reset} variant="outline">{t('goHome')}</Button>
        </div>
      </div>
    </div>
  );
}
