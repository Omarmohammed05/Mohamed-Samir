'use client';

import { useState } from 'react';
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

function allTabsFilled(tabs: EquipmentTab[]): boolean {
  return tabs.every((tab) => tab.rows.every((row) => (row.value || '').trim() !== ''));
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

  const isAdmin = role === 'admin';

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
      const res = await fetch('/api/sheets/card-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'submission', cardId, user: userEmail, rows: allRows }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('saveSuccess'));
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
  const canSave = allTabsFilled(tabData);
  const outOfRangeCount = tabData.reduce(
    (acc, tab) =>
      acc + tab.rows.filter((row) => isOutOfRange(row.value || '', row.min, row.max)).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Tab navigation — pill buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {tabData.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-2 rounded-full font-bold text-sm transition-colors ${
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
                    <span key={label} className="flex items-center gap-1 text-xs font-normal opacity-90">
                      <input type="checkbox" className="h-3 w-3" />
                      {label}
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              tab.label
            )}
          </button>
        ))}
      </div>

      {/* Equipment rows in a rounded card container */}
      <div className="rounded-3xl bg-primary/10 p-4 sm:p-6 flex flex-col gap-4">
        {currentTab.rows.map((row, i) => {
          const outOfRange = isOutOfRange(row.value || '', row.min, row.max);
          return (
            <div key={i} className="flex flex-col gap-2">
              {/* Row 1: Tag No + Description */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[100px] px-4 py-2 rounded-full bg-card border border-border text-center text-sm font-medium">
                  {row.tagNo}
                </div>
                <div className="flex-[2] min-w-[140px] px-4 py-2 rounded-full bg-card border border-border text-center text-sm">
                  {row.description}
                </div>
              </div>
              {/* Row 2: Process Value + Unit/Min/Norm/Max grouped */}
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  type="text"
                  value={row.value || ''}
                  onChange={(e) => handleValueChange(activeTab, i, e.target.value)}
                  className={`w-28 px-4 py-2 rounded-full text-center text-sm border focus:outline-none min-w-[100px] ${
                    outOfRange
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'bg-card border-border focus:border-primary'
                  }`}
                />
                {/* Unit + Min/Norm/Max grouped together */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-muted-foreground font-medium">{row.unit}</span>
                  <div className="px-3 py-1 rounded-full bg-card border border-border flex flex-col items-center gap-0.5 min-w-[55px]">
                  {isAdmin ? (
                    <>
                      <input
                        type="text"
                        value={row.min}
                        onChange={(e) => handleRangeChange(activeTab, i, 'min', e.target.value)}
                        className="w-12 text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.norm}
                        onChange={(e) => handleRangeChange(activeTab, i, 'norm', e.target.value)}
                        className="w-12 text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.max}
                        onChange={(e) => handleRangeChange(activeTab, i, 'max', e.target.value)}
                        className="w-12 text-center text-xs bg-transparent focus:outline-none"
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
            </div>
          );
        })}
      </div>

      {/* Out-of-range warning */}
      {outOfRangeCount > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-700">
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
          <Button variant="outline" onClick={handleSaveRanges} disabled={savingRanges} className="rounded-full">
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
        <Button onClick={handleSaveValues} disabled={!canSave || saving} className="rounded-full">
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
