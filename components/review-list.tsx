'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { StatusBadge } from './status-badge';
import { formatTimestamp, toArabicDigits } from '@/lib/date';
import type { CardEntry } from '@/lib/entry-store';
import type { EquipmentTab } from '@/config/card-data';
import { Loader2, Check, Pencil, Save, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

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

type Props = {
  role: 'operator' | 'supervisor' | 'engineer' | 'admin';
};

export function ReviewList({ role }: Props) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [entries, setEntries] = useState<CardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewEntry, setReviewEntry] = useState<CardEntry | null>(null);
  const [editData, setEditData] = useState<EquipmentTab[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await fetch('/api/card-entries?filter=pending');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function openReview(entry: CardEntry) {
    setReviewEntry(entry);
    // Parse the entry rows into EquipmentTab format for editing
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
    setEditData(Array.from(tabMap.values()));
    setActiveTab(0);
  }

  function handleValueChange(tabIndex: number, rowIndex: number, value: string) {
    setEditData((prev) => {
      const next = [...prev];
      next[tabIndex] = {
        ...next[tabIndex],
        rows: next[tabIndex].rows.map((row, i) =>
          i === rowIndex ? { ...row, value } : row,
        ),
      };
      return next;
    });
  }

  async function handleApprove() {
    if (!reviewEntry) return;
    setSaving(true);
    try {
      // Send edited rows along with the approve action
      const allRows: string[][] = [];
      for (const tab of editData) {
        for (const row of tab.rows) {
          allRows.push([
            tab.label, row.tagNo, row.unit, row.description,
            row.min, row.norm, row.max, row.value || '',
          ]);
        }
      }
      const res = await fetch(`/api/card-entries/${reviewEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', rows: allRows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('review.approveSuccess'));
      setReviewEntry(null);
      loadEntries();
    } catch (err) {
      toast.error((err as Error).message || t('review.approveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!reviewEntry) return;
    setSaving(true);
    try {
      const allRows: string[][] = [];
      for (const tab of editData) {
        for (const row of tab.rows) {
          allRows.push([
            tab.label, row.tagNo, row.unit, row.description,
            row.min, row.norm, row.max, row.value || '',
          ]);
        }
      }
      const res = await fetch(`/api/card-entries/${reviewEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: allRows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('review.editSuccess'));
      setReviewEntry(null);
      loadEntries();
    } catch (err) {
      toast.error((err as Error).message || t('review.editError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canApprove = role === 'supervisor' || role === 'engineer' || role === 'admin';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('review.description')}</p>

      {entries.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center gap-2 min-h-[200px]">
          <p className="text-muted-foreground">{t('review.empty')}</p>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">{entry.card_id}</span>
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
          </div>
          {canApprove && (
            <Button variant="outline" size="sm" onClick={() => openReview(entry)} className="self-start">
              {t('review.open')}
            </Button>
          )}
        </div>
      ))}

      {/* Review / Edit Dialog */}
      <Dialog open={!!reviewEntry} onOpenChange={(v) => !v && setReviewEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewEntry?.card_id} — {t('review.reviewEntry')}
            </DialogTitle>
          </DialogHeader>

          {editData.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Tab buttons */}
              <div className="flex gap-2 flex-wrap justify-center">
                {editData.map((tab, i) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(i)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                      activeTab === i
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border hover:bg-accent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Editable rows */}
              <div className="rounded-xl bg-primary/10 p-3 flex flex-col gap-3">
                {editData[activeTab]?.rows.map((row, i) => (
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
                      <input
                        type="text"
                        value={row.value || ''}
                        onChange={(e) => handleValueChange(activeTab, i, e.target.value)}
                        className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-center text-sm border focus:outline-none ${
                          isOutOfRange(row.value || '', row.min, row.max)
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                            : 'bg-card border-border focus:border-primary'
                        }`}
                      />
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
                ))}
              </div>
            </div>
          )}

          {(() => {
            const count = editData.reduce(
              (acc, tab) =>
                acc +
                tab.rows.filter((row) => isOutOfRange(row.value || '', row.min, row.max)).length,
              0,
            );
            return count > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-700 dark:text-red-300 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>{t('cards.outOfRange')} ({count})</span>
              </div>
            ) : null;
          })()}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('review.saveEdit')}
            </Button>
            {canApprove && (
              <Button onClick={handleApprove} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('review.approve')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
