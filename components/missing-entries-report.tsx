'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Bell, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { todayCairo, weekDates, monthDates, formatDayName, formatDisplay, toArabicDigits } from '@/lib/date';
import type { Entry } from '@/lib/mock-store';

type Props = {
  entries: Entry[];
  knownUsers: { email: string; name: string }[];
};

export function MissingEntriesReport({ entries, knownUsers }: Props) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [sending, setSending] = useState<string | null>(null);

  const today = todayCairo();
  const ar = (s: string | number) => (locale === 'ar' ? toArabicDigits(String(s)) : String(s));

  const dates = useMemo(() => {
    const all = view === 'week' ? weekDates(today) : monthDates(today);
    // Only show up to today (not future dates)
    return all.filter((d) => d <= today);
  }, [view, today]);

  const regularUsers = knownUsers.filter((u) => !u.email.includes('admin'));

  // Map: user -> Set of dates they submitted
  const submittedMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!map.has(e.user)) map.set(e.user, new Set());
      map.get(e.user)!.add(e.date);
    }
    return map;
  }, [entries]);

  // Missing count per user
  const missingByUser = useMemo(() => {
    return regularUsers.map((u) => {
      const submitted = submittedMap.get(u.email) || new Set<string>();
      const missing = dates.filter((d) => !submitted.has(d));
      return { ...u, missing, missingCount: missing.length };
    });
  }, [regularUsers, submittedMap, dates]);

  async function sendReminder(user: { email: string; name: string }, missingDates: string[]) {
    setSending(user.email);
    try {
      const res = await fetch('/api/admin/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name, missingDates }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('reminderSent', { name: user.name }));
      router.refresh();
    } catch {
      toast.error(t('reminderError'));
    } finally {
      setSending(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{t('missingEntriesReport')}</h3>
        <Select value={view} onValueChange={(v) => setView(v as 'week' | 'month')}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t('weekly')}</SelectItem>
            <SelectItem value="month">{t('monthly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t('noData')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start font-medium px-2 py-2 sticky start-0 bg-card">{t('user')}</th>
                {dates.map((d) => (
                  <th key={d} className="text-center font-medium px-1 py-2 min-w-[28px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground">{formatDayName(d, locale).slice(0, 3)}</span>
                      <span>{ar(d.slice(8))}</span>
                    </div>
                  </th>
                ))}
                <th className="text-center font-medium px-2 py-2">{t('missing')}</th>
                <th className="text-center font-medium px-2 py-2">{t('reminder')}</th>
              </tr>
            </thead>
            <tbody>
              {missingByUser.map((u) => (
                <tr key={u.email} className="border-b border-border last:border-0">
                  <td className="text-start font-medium px-2 py-2 sticky start-0 bg-card whitespace-nowrap">
                    {u.name}
                  </td>
                  {dates.map((d) => {
                    const has = (submittedMap.get(u.email) || new Set()).has(d);
                    return (
                      <td key={d} className="text-center px-1 py-2">
                        {has ? (
                          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                        ) : (
                          <span className="text-destructive">✗</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2">
                    {u.missingCount === 0 ? (
                      <Badge variant="secondary" className="text-[10px]">{t('allSubmitted')}</Badge>
                    ) : (
                      <span className="font-medium text-destructive">{ar(u.missingCount)}</span>
                    )}
                  </td>
                  <td className="text-center px-2 py-2">
                    {u.missingCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        disabled={sending === u.email}
                        onClick={() => sendReminder(u, u.missing)}
                      >
                        {sending === u.email ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Bell className="h-3 w-3" />
                        )}
                        <span className="text-[10px]">{t('remind')}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
