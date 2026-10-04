'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp, toArabicDigits } from '@/lib/date';
import type { AuditRecord } from '@/lib/audit';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  edit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export function AuditLogViewer() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ar = (s: string) => (locale === 'ar' ? toArabicDigits(s) : s);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t('auditLog')}</h3>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t('noAuditRecords')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start font-medium px-2 py-2">{t('when')}</th>
                <th className="text-start font-medium px-2 py-2">{t('who')}</th>
                <th className="text-start font-medium px-2 py-2">{t('action')}</th>
                <th className="text-start font-medium px-2 py-2">{t('target')}</th>
                <th className="text-start font-medium px-2 py-2">{t('details')}</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(r.timestamp, locale)}
                  </td>
                  <td className="px-2 py-2 font-medium">{r.actor}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_COLORS[r.action] || ''}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.targetUser} · {ar(r.targetDate)}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground max-w-xs truncate">{r.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
