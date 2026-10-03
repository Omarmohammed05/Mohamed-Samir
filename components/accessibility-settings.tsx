'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Type } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type FontSize = 'normal' | 'large' | 'xl';

const STORAGE_KEY = 'de-font-size';

const SIZE_LABELS: Record<FontSize, string> = {
  normal: '100%',
  large: '115%',
  xl: '130%',
};

function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = SIZE_LABELS[size];
}

export function AccessibilitySettings() {
  const t = useTranslations('common');
  const [size, setSize] = useState<FontSize>('normal');

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as FontSize) || 'normal';
    setSize(saved);
    applyFontSize(saved);
  }, []);

  function setFontSize(s: FontSize) {
    setSize(s);
    localStorage.setItem(STORAGE_KEY, s);
    applyFontSize(s);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('fontSize')}>
          <Type className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setFontSize('normal')}>
          <span>A</span>
          <span>{t('normal')}</span>
          {size === 'normal' && <span className="ms-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFontSize('large')}>
          <span className="text-base">A</span>
          <span>{t('largeText')}</span>
          {size === 'large' && <span className="ms-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFontSize('xl')}>
          <span className="text-lg">A</span>
          <span>{t('extraLarge')}</span>
          {size === 'xl' && <span className="ms-auto">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
