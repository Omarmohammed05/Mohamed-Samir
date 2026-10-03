'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next-intl/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  function toggle() {
    const next = locale === 'en' ? 'ar' : 'en';
    router.replace(pathname, { locale: next });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-2 font-medium"
      aria-label={t('language')}
    >
      <Languages className="h-4 w-4" />
      {locale === 'en' ? 'ع' : 'EN'}
    </Button>
  );
}
