'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { StatusBadge } from './status-badge';
import { formatTimestamp, formatDisplayLong, toArabicDigits } from '@/lib/date';
import { formatDuration } from '@/lib/duration';
import type { CardEntry } from '@/lib/entry-store';
import type { EquipmentTab } from '@/config/card-data';
import { CARD_TABS } from '@/config/cards';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function isOutOfRange(value: string, min: string, max: string): boolean {
  if (!value.trim()) return false;
  const v = parseFloat(value);
  if (isNaN(v)) return false;
  if (min.trim()) {
    const mn = parseFloat(min);
    if (!isNaN(mn) && v < mn) return true;
  }
  if (max.trim()) {
    const mx = parseFloat(max);
    if (!isNaN(mx) && v > mx) return true;
  }
  return false;
}

export function HistoryList() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [entries, setEntries] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCard, setFilterCard] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [detailEntry, setDetailEntry] = useState<CardEntry | null>(null);
  const [detailGroups, setDetailGroups] = useState<EquipmentTab[]>([]);

  useEffect(() => {
    fetch('/api/card-entries?filter=history')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Parse the entry's rows into read-only equipment groups for the details dialog
  function openDetails(entry: CardEntry) {
    const tabMap = new Map<string, EquipmentTab>();
    for (const row of entry.rows) {
      const [equipment, tagNo, unit, description, min, norm, max, value] = row;
      if (!tabMap.has(equipment)) {
        tabMap.set(equipment, { id: equipment, label: equipment, rows: [] });
      }
      tabMap.get(equipment)!.rows.push({
        tagNo, unit, description, min, norm, max, value: value || '',
      });
    }
    setDetailGroups(Array.from(tabMap.values()));
    setDetailEntry(entry);
  }

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
                {entry.duration_seconds != null && (
                  <span>{t('history.duration')}: <span className="font-medium text-foreground">{formatDuration(entry.duration_seconds)}</span></span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => openDetails(entry)} className="self-start">
                {t('history.open')}
              </Button>
            </div>
          ))}
        </div>
      ))}

      {/* Details dialog (read-only) */}
      <Dialog open={!!detailEntry} onOpenChange={(v) => !v && setDetailEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailEntry?.card_id} — {t('history.detailsTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {detailGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-center">{group.label}</h3>
                <div className="rounded-xl bg-primary/10 p-3 flex flex-col gap-3">
                  {group.rows.map((row, i) => {
                    const outOfRange = isOutOfRange(row.value || '', row.min, row.max);
                    return (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex gap-2">
                          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-xs font-medium overflow-hidden">
                            <span className="block w-full break-words leading-tight">{row.tagNo}</span>
                          </div>
                          <div className="flex-[2] min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-xs overflow-hidden">
                            <span className="block w-full break-words leading-tight">{row.description}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 items-stretch">
                          <div className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-center text-sm border overflow-hidden ${
                            outOfRange
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                              : 'bg-card border-border'
                          }`}>
                            {row.value || '—'}
                          </div>
                          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-sm flex items-center justify-center">
                            {row.unit}
                          </div>
                          <div className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-card border border-border flex flex-col items-center justify-center gap-0.5">
                            <span className="text-xs leading-tight">{row.min}</span>
                            <span className="text-xs leading-tight">{row.norm}</span>
                            <span className="text-xs leading-tight">{row.max}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
