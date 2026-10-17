'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { StatusBadge } from './status-badge';
import { formatTimestamp, formatDisplayLong, toArabicDigits } from '@/lib/date';
import { formatDuration } from '@/lib/card-config-utils';
import type { CardEntry } from '@/lib/entry-store';
import { CARD_TABS } from '@/config/cards';
import type { UserRole } from '@/config/mock-users';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export function HistoryList({ role }: { role: UserRole }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [entries, setEntries] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCard, setFilterCard] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetch('/api/card-entries?filter=history')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterCard !== 'all' && e.card_id !== filterCard) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      return true;
    });
  }, [entries, filterCard, filterStatus]);

  // Group by day (YYYY-MM-DD), newest first
  const grouped = useMemo(() => {
    const map = new Map<string, CardEntry[]>();
    for (const e of filtered) {
      const day = e.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterCard} onValueChange={setFilterCard}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('history.filterCard')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('history.allCards')}</SelectItem>
            {CARD_TABS.map((tab) => (
              <SelectItem key={tab} value={tab}>{tab}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('history.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('history.allStatuses')}</SelectItem>
            <SelectItem value="Operator">{t('status.operator')}</SelectItem>
            <SelectItem value="Supervisor">{t('status.supervisor')}</SelectItem>
            <SelectItem value="Engineer">{t('status.engineer')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{t('history.empty')}</p>
      )}

      {grouped.map(([day, dayEntries]) => (
        <div key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground sticky top-16 bg-background/80 backdrop-blur-sm py-1">
            {locale === 'ar' ? toArabicDigits(formatDisplayLong(day, locale)) : formatDisplayLong(day, locale)}
          </h2>
          {dayEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{entry.card_id}</span>
                  <StatusBadge status={entry.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {locale === 'ar' ? toArabicDigits(formatTimestamp(entry.created_at, locale)) : formatTimestamp(entry.created_at, locale)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {entry.operator_name && (
                  <span>{t('history.operator')}: <span className="font-medium text-foreground">{entry.operator_name}</span></span>
                )}
                {entry.supervisor_name && (
                  <span>{t('history.supervisor')}: <span className="font-medium text-foreground">{entry.supervisor_name}</span></span>
                )}
                {entry.engineer_name && (
                  <span>{t('history.engineer')}: <span className="font-medium text-foreground">{entry.engineer_name}</span></span>
                )}
                {role === 'admin' && entry.duration_seconds != null && (
                  <span>{t('history.duration')}: <span className="font-medium text-foreground">{formatDuration(entry.duration_seconds)}</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
