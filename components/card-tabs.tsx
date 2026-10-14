'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EquipmentTab, CardInputRow } from '@/config/card-data';

export function CardTabs({ cardId, tabs }: { cardId: string; tabs: EquipmentTab[] }) {
  const t = useTranslations('cards');
  const [activeTab, setActiveTab] = useState(0);
  const [tabData, setTabData] = useState<EquipmentTab[]>(tabs);
  const [saving, setSaving] = useState(false);

  function handleInputChange(
    tabIndex: number,
    rowIndex: number,
    field: keyof Pick<CardInputRow, 'min' | 'norm' | 'max'>,
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

  async function handleSave() {
    setSaving(true);
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
        body: JSON.stringify({ cardId, rows: allRows }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const currentTab = tabData[activeTab];

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
            </tr>
            <tr>
              <th className="border border-black p-2 text-center bg-muted/30">{t('min')}</th>
              <th className="border border-black p-2 text-center bg-muted/30">{t('norm')}</th>
              <th className="border border-black p-2 text-center bg-muted/30">{t('max')}</th>
            </tr>
          </thead>
          <tbody>
            {currentTab.rows.map((row, i) => (
              <tr key={i}>
                <td className="border border-black p-2 font-medium whitespace-nowrap">{row.tagNo}</td>
                <td className="border border-black p-2 whitespace-nowrap">{row.unit}</td>
                <td className="border border-black p-2">{row.description}</td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={row.min}
                    onChange={(e) => handleInputChange(activeTab, i, 'min', e.target.value)}
                    className="w-20 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                  />
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={row.norm}
                    onChange={(e) => handleInputChange(activeTab, i, 'norm', e.target.value)}
                    className="w-20 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                  />
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={row.max}
                    onChange={(e) => handleInputChange(activeTab, i, 'max', e.target.value)}
                    className="w-20 px-2 py-1 text-center bg-transparent border border-border rounded focus:border-primary focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
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
