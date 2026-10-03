'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { todayCairo, daysAgo, formatDisplay, toArabicDigits } from '@/lib/date';
import type { Entry } from '@/lib/mock-store';

type Props = {
  entries: Entry[];
  knownUsers: { email: string; name: string }[];
};

export function AdminCharts({ entries, knownUsers }: Props) {
  const t = useTranslations('admin');
  const locale = useLocale() as 'en' | 'ar';
  const today = todayCairo();
  const ar = (s: string | number) => (locale === 'ar' ? toArabicDigits(String(s)) : String(s));

  // Entries per day (last 14 days)
  const perDay = useMemo(() => {
    const days: { date: string; count: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = daysAgo(today, i);
      const count = entries.filter((e) => e.date === d).length;
      days.push({ date: d, count, label: formatDisplay(d, locale) });
    }
    return days;
  }, [entries, today, locale]);

  const maxDay = Math.max(1, ...perDay.map((d) => d.count));

  // Entries per user
  const perUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      counts.set(e.user, (counts.get(e.user) || 0) + 1);
    }
    return knownUsers
      .map((u) => ({ email: u.email, name: u.name, count: counts.get(u.email) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [entries, knownUsers]);

  const maxUser = Math.max(1, ...perUser.map((u) => u.count));

  // Completion rate over time (last 14 days)
  const completionRate = useMemo(() => {
    const totalUsers = knownUsers.filter((u) => u.email !== 'admin@team.com').length || 1;
    return perDay.map((d) => ({
      date: d.date,
      label: d.label,
      rate: Math.round((d.count / totalUsers) * 100),
    }));
  }, [perDay, knownUsers]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Entries per day */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{t('entriesPerDay')}</h3>
        <div className="flex items-end gap-1 h-32">
          {perDay.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {ar(d.count)}
              </span>
              <div
                className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${(d.count / maxDay) * 100}%` }}
                title={`${d.label}: ${ar(d.count)}`}
              />
              <span className="text-[9px] text-muted-foreground -rotate-45 origin-top whitespace-nowrap">
                {ar(d.date.slice(5))}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Completion rate */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{t('completionRate')}</h3>
        <div className="flex items-end gap-1 h-32">
          {completionRate.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {ar(d.rate)}%
              </span>
              <div
                className="w-full rounded-t bg-emerald-500/80 hover:bg-emerald-500 transition-colors min-h-[2px]"
                style={{ height: `${d.rate}%` }}
                title={`${d.label}: ${ar(d.rate)}%`}
              />
              <span className="text-[9px] text-muted-foreground -rotate-45 origin-top whitespace-nowrap">
                {ar(d.date.slice(5))}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Entries per user */}
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold mb-3">{t('entriesPerUser')}</h3>
        <div className="flex flex-col gap-2">
          {perUser.map((u) => (
            <div key={u.email} className="flex items-center gap-2">
              <span className="text-xs font-medium w-24 truncate">{u.name}</span>
              <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full rounded bg-primary/70 transition-all"
                  style={{ width: `${(u.count / maxUser) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-end">{ar(u.count)}</span>
            </div>
          ))}
          {perUser.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('noData')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
