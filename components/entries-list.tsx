'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Search, Trash2, Pencil, Loader2, AlertTriangle } from 'lucide-react';
import { isOutOfRange, type FieldRange } from '@/lib/range-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { FIELDS } from '@/config/fields';
import { formatDisplay } from '@/lib/date';
import type { Entry } from '@/lib/mock-store';

const PAGE_SIZE = 5;

export function EntriesList({ initialEntries, todayDate }: { initialEntries: Entry[]; todayDate: string }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();

  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [editTarget, setEditTarget] = useState<Entry | null>(null);
  const [editFields, setEditFields] = useState({ a: '', b: '', c: '', d: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ranges, setRanges] = useState<Record<string, FieldRange>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setRanges(data.ranges || {}))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) =>
      [e.a, e.b, e.c, e.d, e.date].some((v) => v.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${deleteTarget.date}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setEntries(entries.filter((e) => e.date !== deleteTarget.date));
      toast.success(t('entries.deleteSuccess'));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(t('entries.deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(entry: Entry) {
    setEditTarget(entry);
    setEditFields({ a: entry.a, b: entry.b, c: entry.c, d: entry.d });
    setEditErrors({});
  }

  async function handleEditSave() {
    if (!editTarget) return;
    const errs: Record<string, string> = {};
    for (const f of FIELDS) {
      if (!editFields[f.key].trim()) errs[f.key] = t('entries.fieldsRequired');
      else if (editFields[f.key].length > 1000) errs[f.key] = t('entries.maxChars');
    }
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editTarget.date, ...editFields }),
      });
      if (!res.ok) throw new Error();
      setEntries(entries.map((e) =>
        e.date === editTarget.date ? { ...e, ...editFields, updatedAt: new Date().toISOString() } : e,
      ));
      toast.success(t('entries.saveSuccess'));
      setEditTarget(null);
      router.refresh();
    } catch {
      toast.error(t('entries.saveError'));
    } finally {
      setLoading(false);
    }
  }

  if (entries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Pencil className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{t('entries.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('entries.emptyDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('entries.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="ps-9"
        />
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-3">
        {pageItems.map((entry) => (
          <Card key={entry.date} className="animate-fade-in overflow-hidden">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <time className="text-sm font-medium text-primary">
                    {formatDisplay(entry.date, locale)}
                  </time>
                </div>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="flex flex-col">
                      <dt className="text-xs font-medium text-muted-foreground">{f.label[locale]}</dt>
                      <dd className="text-sm break-words">{entry[f.key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <Button variant="outline" size="icon" onClick={() => startEdit(entry)} aria-label={t('common.edit')}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setDeleteTarget(entry)} aria-label={t('common.delete')} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            {t('common.previous')}
          </Button>
          <span className="text-muted-foreground">
            {current + 1} / {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('entries.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('entries.deleteConfirmDescription', { date: deleteTarget ? formatDisplay(deleteTarget.date, locale) : '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('entries.editTitle')}</DialogTitle>
            <DialogDescription>
              {editTarget ? formatDisplay(editTarget.date, locale) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={`edit-${f.key}`}>{f.label[locale]}</Label>
                <Textarea
                  id={`edit-${f.key}`}
                  value={editFields[f.key]}
                  onChange={(e) => setEditFields({ ...editFields, [f.key]: e.target.value })}
                  maxLength={1000}
                  rows={2}
                  className={editErrors[f.key] ? 'border-destructive' : ''}
                />
                {editErrors[f.key] && (
                  <span className="text-xs text-destructive">{editErrors[f.key]}</span>
                )}
                {ranges[f.key] && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {t('entries.rangeHint', { min: ranges[f.key].min, max: ranges[f.key].max })}
                    </span>
                    {isOutOfRange(editFields[f.key], ranges[f.key]) && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        {t('entries.rangeWarning', { min: ranges[f.key].min, max: ranges[f.key].max })}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button onClick={handleEditSave} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
