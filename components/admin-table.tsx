'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  RefreshCw, Download, ExternalLink, Search, ArrowUp, ArrowDown, AlertTriangle, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { FIELDS } from '@/config/fields';
import { formatDisplay, todayCairo } from '@/lib/date';
import type { Entry } from '@/lib/mock-store';
import type { Session } from '@/lib/auth';

type SortKey = 'date' | 'user' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

type Props = {
  entries: Entry[];
  warnings: string[];
  knownUsers: { email: string; name: string }[];
  sheetsMode: 'mock' | 'excel' | 'real';
  sheetUrl: string | null;
  session: Session;
  notSubmitted: { email: string; name: string }[];
};

export function AdminTable({ entries, warnings, knownUsers, sheetsMode, sheetUrl, notSubmitted }: Props) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const today = todayCairo();
  const entriesToday = entries.filter((e) => e.date === today).length;

  const filtered = useMemo(() => {
    let result = [...entries];

    if (userFilter !== 'all') {
      result = result.filter((e) => e.user === userFilter);
    }
    if (dateFrom) {
      result = result.filter((e) => e.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((e) => e.date <= dateTo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        [e.a, e.b, e.c, e.d, e.user, e.date].some((v) => v.toLowerCase().includes(q)),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'user') cmp = a.user.localeCompare(b.user);
      else if (sortKey === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, userFilter, dateFrom, dateTo, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
      toast.success(t('admin.refreshSuccess'));
    }, 800);
  }

  function exportCSV() {
    const headers = ['Date', 'User', ...FIELDS.map((f) => f.label.en), 'UpdatedAt'];
    const rows = filtered.map((e) =>
      [e.date, e.user, e.a, e.b, e.c, e.d, e.updatedAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entries-${todayCairo()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.csvExported'));
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('admin.totalEntries')}</p>
          <p className="text-2xl font-bold mt-1">{entries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('admin.entriesToday')}</p>
          <p className="text-2xl font-bold mt-1">{entriesToday}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('admin.notSubmitted')}</p>
          {notSubmitted.length === 0 ? (
            <p className="text-sm font-medium text-primary mt-1">✓</p>
          ) : (
            <div className="flex flex-wrap gap-1 mt-1">
              {notSubmitted.map((u) => (
                <Badge key={u.email} variant="secondary" className="text-xs">
                  {u.name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-sm text-amber-800 dark:text-amber-200">{t('admin.dataWarnings')}</p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('common.refresh')}
          </Button>
          {sheetsMode === 'real' && sheetUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t('common.openInSheets')}
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            {t('common.export')}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="ps-9"
            />
          </div>
          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder={t('admin.allUsers')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.allUsers')}</SelectItem>
              {knownUsers.map((u) => (
                <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">{t('admin.dateFrom')}</Label>
            <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dateTo" className="text-xs text-muted-foreground">{t('admin.dateTo')}</Label>
            <Input id="dateTo" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                <th className="w-10 border border-border px-2 py-2 text-center text-xs font-medium text-muted-foreground">#</th>
                <th className="border border-border px-3 py-2 text-start font-medium">
                  <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('date')}>
                    {t('admin.date')}{sortIcon('date')}
                  </button>
                </th>
                <th className="border border-border px-3 py-2 text-start font-medium">
                  <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('user')}>
                    {t('admin.user')}{sortIcon('user')}
                  </button>
                </th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="border border-border px-3 py-2 text-start font-medium">{f.label[locale]}</th>
                ))}
                <th className="border border-border px-3 py-2 text-start font-medium">
                  <button className="flex items-center gap-1 hover:text-primary" onClick={() => toggleSort('updatedAt')}>
                    {t('admin.updatedAt')}{sortIcon('updatedAt')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry, i) => {
                const user = knownUsers.find((u) => u.email === entry.user);
                return (
                  <tr key={`${entry.user}-${entry.date}-${i}`}>
                    <td className="w-10 border border-border bg-muted/30 px-2 py-2 text-center text-xs text-muted-foreground">{current * PAGE_SIZE + i + 1}</td>
                    <td className="border border-border px-3 py-2 whitespace-nowrap font-medium">{formatDisplay(entry.date, locale)}</td>
                    <td className="border border-border px-3 py-2">
                      <div className="font-medium">{user?.name || entry.user}</div>
                      <div className="text-xs text-muted-foreground">{entry.user}</div>
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="border border-border px-3 py-2 max-w-xs truncate">{entry[f.key] || '—'}</td>
                    ))}
                    <td className="border border-border px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {pageItems.map((entry, i) => {
          const user = knownUsers.find((u) => u.email === entry.user);
          return (
            <Card key={`${entry.user}-${entry.date}-${i}`} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">{formatDisplay(entry.date, locale)}</span>
                <Badge variant="secondary" className="text-xs">{user?.name || entry.user}</Badge>
              </div>
              <dl className="grid grid-cols-1 gap-2">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs font-medium text-muted-foreground">{f.label[locale]}</dt>
                    <dd className="text-sm break-words">{entry[f.key] || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground mt-3">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : ''}</p>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            {t('common.previous')}
          </Button>
          <span className="text-muted-foreground">{current + 1} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{t('common.noResults')}</p>
      )}
    </div>
  );
}
