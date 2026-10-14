'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CARD_TABS } from '@/config/cards';
import { toast } from 'sonner';
import { FolderOpen, Loader2 } from 'lucide-react';

export function CardsGrid() {
  const t = useTranslations();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreateTabs() {
    setCreating(true);
    try {
      const res = await fetch('/api/sheets/tabs', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(t('cards.tabsCreated'));
    } catch {
      toast.error(t('cards.tabsError'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={handleCreateTabs} disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('cards.creatingTabs')}
            </>
          ) : (
            t('cards.createTabs')
          )}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {CARD_TABS.map((tab) => (
          <Card
            key={tab}
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all p-6 flex flex-col items-center justify-center gap-3"
            onClick={() => router.push(`/cards/${tab}`)}
          >
            <span className="text-2xl font-bold tracking-tight">{tab}</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              {t('cards.openCard')}
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}
