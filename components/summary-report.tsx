'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDisplay, formatDayName, weekDates, todayCairo, toArabicDigits } from '@/lib/date';
import type { Entry } from '@/lib/mock-store';

type Props = {
  entries: Entry[];
  knownUsers: { email: string; name: string }[];
};

export function SummaryReport({ entries, knownUsers }: Props) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const locale = useLocale() as 'en' | 'ar';
  const [weekOffset, setWeekOffset] = useState(0);

  const today = todayCairo();
  const ar = (s: string | number) => (locale === 'ar' ? toArabicDigits(String(s)) : String(s));

  // Get the week to display (offset from current week)
  const weekStart = useMemo(() => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [today, weekOffset]);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  const regularUsers = knownUsers.filter((u) => !u.email.includes('admin'));

  const submittedMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!map.has(e.user)) map.set(e.user, new Set());
      map.get(e.user)!.add(e.date);
    }
    return map;
  }, [entries]);

  const weekEntries = entries.filter((e) => dates.includes(e.date));
  const totalEntries = weekEntries.length;
  const totalMissing = regularUsers.reduce((sum, u) => {
    const submitted = submittedMap.get(u.email) || new Set();
    return sum + dates.filter((d) => d <= today && !submitted.has(d)).length;
  }, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-4 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>
            ←
          </Button>
          <span className="text-sm font-medium">
            {ar(weekOffset === 0 ? t('thisWeek') : `${weekOffset} ${t('weeksAgo')}`)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0}>
            →
          </Button>
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('printPdf')}
        </Button>
      </div>

      {/* Printable content */}
      <div className="print:block">
        <h1 className="text-xl font-bold mb-1">{t('weeklySummary')}</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {formatDisplay(dates[0], locale)} — {formatDisplay(dates[6], locale)}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4 print:grid-cols-2">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t('totalEntries')}</p>
            <p className="text-xl font-bold">{ar(totalEntries)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t('missingDays')}</p>
            <p className="text-xl font-bold text-destructive">{ar(totalMissing)}</p>
          </Card>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-start py-2 px-2 font-semibold">{t('user')}</th>
              {dates.map((d) => (
                <th key={d} className="text-center py-2 px-1 font-semibold min-w-[40px]">
                  <div className="flex flex-col">
                    <span className="text-[10px]">{formatDayName(d, locale).slice(0, 3)}</span>
                    <span>{ar(d.slice(8))}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regularUsers.map((u) => {
              const submitted = submittedMap.get(u.email) || new Set();
              return (
                <tr key={u.email} className="border-b border-border">
                  <td className="py-2 px-2 font-medium">{u.name}</td>
                  {dates.map((d) => (
                    <td key={d} className="text-center py-2 px-1">
                      {d > today ? (
                        <span className="text-muted-foreground">—</span>
                      ) : submitted.has(d) ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-destructive">✗</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Entry details for the week */}
        <h2 className="text-lg font-semibold mt-6 mb-2">{t('entriesDetail')}</h2>
        <div className="flex flex-col gap-2">
          {weekEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noEntriesThisWeek')}</p>
          ) : (
            weekEntries.sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => {
              const user = knownUsers.find((u) => u.email === e.user);
              return (
                <div key={i} className="border border-border rounded p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{user?.name || e.user}</span>
                    <span className="text-muted-foreground">{formatDisplay(e.date, locale)}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-muted-foreground">A:</dt><dd>{e.a || '—'}</dd>
                    <dt className="text-muted-foreground">B:</dt><dd>{e.b || '—'}</dd>
                    <dt className="text-muted-foreground">C:</dt><dd>{e.c || '—'}</dd>
                    <dt className="text-muted-foreground">D:</dt><dd>{e.d || '—'}</dd>
                  </dl>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
