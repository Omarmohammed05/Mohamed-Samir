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
      {/* Equipment header */}
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-sm">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold bg-muted/50 whitespace-nowrap">
                Equipment
              </td>
              {tabData.map((tab, i) => (
                <td
                  key={tab.id}
                  className={`border border-black p-2 text-center cursor-pointer transition-colors min-w-[120px] ${
                    activeTab === i ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                  onClick={() => setActiveTab(i)}
                >
                  {tab.subLabels ? (
                    <div className="flex flex-col gap-1">
                      {tab.subLabels.map((label) => (
                        <div key={label} className="flex items-center gap-2 justify-center">
                          <span className="whitespace-nowrap">{label}</span>
                          <input type="checkbox" className="h-3.5 w-3.5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    tab.label
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Out-of-range warning */}
      {outOfRangeCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t('outOfRange')} ({outOfRangeCount})</span>
        </div>
      )}

      {/* Input table */}
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-sm">
          <thead>
            <tr>
              <th className="border border-black p-2 text-left bg-muted/30" rowSpan={2}>
                {t('tagNo')}
              </th>
              <th className="border border-black p-2 text-left bg-muted/30" rowSpan={2}>
                {t('unit')}
              </th>
              <th className="border border-black p-2 text-left bg-muted/30" rowSpan={2}>
                {t('description')}
              </th>
              <th className="border border-black p-2 text-center bg-muted/30" colSpan={3}>
                {t('operatingRange')}
              </th>
              <th className="border border-black p-2 text-center bg-primary/10" rowSpan={2}>
                {t('processValue')}
              </th>
            </tr>
            <tr>
              <th className="border border-black p-2 text-center bg-muted/30">{t('min')}</th>
              <th className="border border-black p-2 text-center bg-muted/30">{t('norm')}</th>
              <th className="border border-black p-2 text-center bg-muted/30">{t('max')}</th>
            </tr>
          </thead>
          <tbody>
            {currentTab.rows.map((row, i) => {
              const outOfRange = isOutOfRange(row.value || '', row.min, row.max);
              return (
                <tr key={i}>
                  <td className="border border-black p-2 font-medium whitespace-nowrap">{row.tagNo}</td>
                  <td className="border border-black p-2 whitespace-nowrap">{row.unit}</td>
                  <td className="border border-black p-2">{row.description}</td>
                  {isAdmin ? (
                    <>
                      <td className="border border-black p-1">
                        <input
                          type="text"
                          value={row.min}
                          onChange={(e) => handleRangeChange(activeTab, i, 'min', e.target.value)}
                          className="w-16 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="border border-black p-1">
                        <input
                          type="text"
                          value={row.norm}
                          onChange={(e) => handleRangeChange(activeTab, i, 'norm', e.target.value)}
                          className="w-16 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="border border-black p-1">
                        <input
                          type="text"
                          value={row.max}
                          onChange={(e) => handleRangeChange(activeTab, i, 'max', e.target.value)}
                          className="w-16 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border border-black p-2 text-center text-muted-foreground">{row.min}</td>
                      <td className="border border-black p-2 text-center text-muted-foreground">{row.norm}</td>
                      <td className="border border-black p-2 text-center text-muted-foreground">{row.max}</td>
                    </>
                  )}
                  <td className="border border-black p-1">
                    <input
                      type="text"
                      value={row.value || ''}
                      onChange={(e) => handleValueChange(activeTab, i, e.target.value)}
                      className={`w-20 px-2 py-1 text-center bg-transparent border rounded focus:outline-none ${
                        outOfRange
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-border focus:border-primary'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* All tabs required notice */}
      {!canSave && (
        <p className="text-sm text-muted-foreground">{t('allTabsRequired')}</p>
      )}

      {/* Save buttons */}
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <Button variant="outline" onClick={handleSaveRanges} disabled={savingRanges}>
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
        <Button onClick={handleSaveValues} disabled={!canSave || saving}>
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
