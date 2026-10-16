'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Loader2, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EquipmentTab } from '@/config/card-data';

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

export function CardTabs({
  cardId,
  tabs,
  role,
  userEmail,
}: {
  cardId: string;
  tabs: EquipmentTab[];
  role: 'admin' | 'user';
  userEmail: string;
}) {
  const t = useTranslations('cards');
  const [activeTab, setActiveTab] = useState(0);
  const [tabData, setTabData] = useState<EquipmentTab[]>(tabs);
  const [saving, setSaving] = useState(false);
  const [savingRanges, setSavingRanges] = useState(false);
  // Track when the operator opened the card to compute entry duration
  const startTimeRef = useRef<number>(Date.now());
  // A/B filter — every sub-label starts checked (show both)
  const [subFilter, setSubFilter] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const tab of tabs) {
      for (const sub of tab.subLabels || []) init[sub] = true;
    }
    return init;
  });

  const isAdmin = role === 'admin';

  function toggleSub(sub: string) {
    setSubFilter((prev) => ({ ...prev, [sub]: !prev[sub] }));
  }

  function isRowVisible(row: { group?: string }): boolean {
    return !row.group || !!subFilter[row.group];
  }

  function handleValueChange(tabIndex: number, rowIndex: number, value: string) {
    setTabData((prev) => {
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

  function handleRangeChange(
    tabIndex: number,
    rowIndex: number,
    field: 'min' | 'norm' | 'max',
    value: string,
  ) {
    setTabData((prev) => {
      const next = [...prev];
      next[tabIndex] = {
        ...next[tabIndex],
        rows: next[tabIndex].rows.map((row, i) =>
          i === rowIndex ? { ...row, [field]: value } : row,
        ),
      };
      return next;
    });
  }

  async function handleSaveValues() {
    setSaving(true);
    try {
      const allRows: string[][] = [];
      for (const tab of tabData) {
        for (const row of tab.rows) {
          allRows.push([
            tab.label, row.tagNo, row.unit, row.description,
            row.min, row.norm, row.max, row.value || '',
          ]);
        }
      }
      // Record which A/B filter checkboxes were checked at save time
      const checkedSubs = Object.entries(subFilter)
        .filter(([, checked]) => checked)
        .map(([label]) => label)
        .join(', ');
      // Compute the duration the operator took to fill in the entry
      const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const duration = `${mins}m ${secs}s`;
      const res = await fetch('/api/sheets/card-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'submission', cardId, user: userEmail, rows: allRows,
          filter: checkedSubs, duration,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('saveSuccess'));
      setTabData((prev) =>
        prev.map((tab) => ({
          ...tab,
          rows: tab.rows.map((row) => ({ ...row, value: '' })),
        })),
      );
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRanges() {
    setSavingRanges(true);
    try {
      const allRows: string[][] = [];
      for (const tab of tabData) {
        for (const row of tab.rows) {
          allRows.push([tab.label, row.tagNo, row.unit, row.description, row.min, row.norm, row.max]);
        }
      }
      const res = await fetch('/api/sheets/card-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'config', cardId, rows: allRows }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('rangesSaved'));
    } catch {
      toast.error(t('rangesSaveError'));
    } finally {
      setSavingRanges(false);
    }
  }

  const currentTab = tabData[activeTab];
  // Only rows visible under the A/B filter are required for saving
  const canSave = tabData.every((tab) =>
    tab.rows
      .filter(isRowVisible)
      .every((row) => (row.value || '').trim() !== ''),
  );
  const outOfRangeCount = tabData.reduce(
    (acc, tab) =>
      acc +
      tab.rows
        .filter(isRowVisible)
        .filter((row) => isOutOfRange(row.value || '', row.min, row.max)).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Tab navigation — rectangular buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {tabData.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
              activeTab === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border hover:bg-accent'
            }`}
          >
            {tab.subLabels ? (
              <span className="flex flex-col items-center gap-1">
                <span>{tab.label}</span>
                <span className="flex flex-col gap-0.5 items-center">
                  {tab.subLabels.map((label) => (
                    <label
                      key={label}
                      className="flex items-center gap-1 text-xs font-normal opacity-90 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3 accent-primary"
                        checked={!!subFilter[label]}
                        onChange={() => toggleSub(label)}
                      />
                      {label}
                    </label>
                  ))}
                </span>
              </span>
            ) : (
              tab.label
            )}
          </button>
        ))}
      </div>

      {/* Equipment rows in a card container */}
      <div className="rounded-xl bg-primary/10 p-3 sm:p-5 flex flex-col gap-3">
        {currentTab.rows.map((row, i) => {
          if (!isRowVisible(row)) return null;
          const outOfRange = isOutOfRange(row.value || '', row.min, row.max);
          // In A/B tabs the tag character sits on its own line with the number under it
          const [tagCode, ...tagNumbers] = row.tagNo.split(' ');
          const stackedTag = Boolean(currentTab.subLabels && tagNumbers.length > 0);
          return (
            <div key={i} className="flex flex-col gap-1.5">
              {/* Row 1: Tag No + Description */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-xs font-medium overflow-hidden">
                  {stackedTag ? (
                    <>
                      <span className="block w-full leading-tight font-semibold">{tagCode}</span>
                      <span className="block w-full break-words leading-tight">{tagNumbers.join(' ')}</span>
                    </>
                  ) : (
                    <span className="block w-full break-words leading-tight">{row.tagNo}</span>
                  )}
                </div>
                <div className="flex-[2] min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-xs overflow-hidden">
                  <span className="block w-full break-words leading-tight">{row.description}</span>
                </div>
              </div>
              {/* Row 2: Process Value + Unit + Min/Norm/Max */}
              <div className="flex gap-2 items-stretch">
                <input
                  type="text"
                  value={row.value || ''}
                  onChange={(e) => handleValueChange(activeTab, i, e.target.value)}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-center text-sm border focus:outline-none ${
                    outOfRange
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                      : 'bg-card border-border focus:border-primary'
                  }`}
                />
                <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-sm flex items-center justify-center">
                  {row.unit}
                </div>
                {/* Min/Norm/Max stacked */}
                <div className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-card border border-border flex flex-col items-center justify-center gap-0.5">
                  {isAdmin ? (
                    <>
                      <input
                        type="text"
                        value={row.min}
                        onChange={(e) => handleRangeChange(activeTab, i, 'min', e.target.value)}
                        className="w-full max-w-[60px] text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.norm}
                        onChange={(e) => handleRangeChange(activeTab, i, 'norm', e.target.value)}
                        className="w-full max-w-[60px] text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.max}
                        onChange={(e) => handleRangeChange(activeTab, i, 'max', e.target.value)}
                        className="w-full max-w-[60px] text-center text-xs bg-transparent focus:outline-none"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-xs leading-tight">{row.min}</span>
                      <span className="text-xs leading-tight">{row.norm}</span>
                      <span className="text-xs leading-tight">{row.max}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Out-of-range warning */}
      {outOfRangeCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-700 dark:text-red-300 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t('outOfRange')} ({outOfRangeCount})</span>
        </div>
      )}

      {/* All tabs required notice */}
      {!canSave && (
        <p className="text-sm text-muted-foreground text-center">{t('allTabsRequired')}</p>
      )}

      {/* Save buttons */}
      <div className="flex justify-center gap-2">
        {isAdmin && (
          <Button variant="outline" onClick={handleSaveRanges} disabled={savingRanges} className="rounded-lg">
            {savingRanges ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <SlidersHorizontal className="h-4 w-4" />
                {t('saveRanges')}
              </>
            )}
          </Button>
        )}
        <Button onClick={handleSaveValues} disabled={!canSave || saving} className="rounded-lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('save')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
