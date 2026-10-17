'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { CardTabs } from '@/components/card-tabs';
import type { EquipmentTab } from '@/config/card-data';
import type { UserRole } from '@/config/mock-users';

/**
 * Card page shell: header (back link, card id, Sync button) + the tab grid.
 * Fresh data is fetched from the sheet when the user enters the page and
 * every time they press Sync — the server-rendered layout is only the first
 * paint, so containers added elsewhere show without a browser refresh.
 */
export function CardView({
  cardId,
  tabs,
  role,
  userEmail,
}: {
  cardId: string;
  tabs: EquipmentTab[];
  role: UserRole;
  userEmail: string;
}) {
  const t = useTranslations('cards');
  const [currentTabs, setCurrentTabs] = useState<EquipmentTab[]>(tabs);
  const [syncing, setSyncing] = useState(false);

  async function sync(announce: boolean) {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/sheets/card-data?cardId=${encodeURIComponent(cardId)}`,
      );
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      setCurrentTabs(data.tabs);
      if (announce) toast.success(t('synced'));
    } catch {
      if (announce) toast.error(t('syncFailed'));
    } finally {
      setSyncing(false);
    }
  }

  // Always fetch the latest data when the user enters the card page —
  // the entry navigation may have been served from the router cache.
  useEffect(() => {
    sync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  return (
    <>
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/cards">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{cardId}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sync(true)}
          disabled={syncing}
          className="ml-auto rounded-lg"
        >
          <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {syncing ? t('syncing') : t('sync')}
        </Button>
      </div>
      {currentTabs.length > 0 ? (
        <CardTabs cardId={cardId} tabs={currentTabs} role={role} userEmail={userEmail} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <p className="text-muted-foreground text-center">{t('cardContent')}</p>
        </div>
      )}
    </>
  );
}
