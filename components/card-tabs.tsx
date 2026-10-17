'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Loader2, SlidersHorizontal, AlertTriangle, Pencil, Trash2, Settings2, Plus, Undo2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EquipmentTab } from '@/config/card-data';
import type { UserRole } from '@/config/mock-users';
import { ContainerEditDialog, type ContainerEditValues } from '@/components/container-edit-dialog';

/** Layout fields that make up a persisted container config (values excluded) */
function layoutOf(tabs: EquipmentTab[]): string {
  return JSON.stringify(
    tabs.map((tab) =>
      tab.rows.map((r) => [r.tagNo, r.description, r.unit, r.min, r.norm, r.max, !!r.hidden]),
    ),
  );
}

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
  role: UserRole;
  userEmail: string;
}) {
  const t = useTranslations('cards');
  const [activeTab, setActiveTab] = useState(0);
  const [tabData, setTabData] = useState<EquipmentTab[]>(tabs);
  const [saving, setSaving] = useState(false);
  const [savingRanges, setSavingRanges] = useState(false);
  // A/B filter — sub-labels start unchecked (operator picks which to show)
  const [subFilter, setSubFilter] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const tab of tabs) {
      for (const sub of tab.subLabels || []) init[sub] = false;
    }
    return init;
  });

  const isAdmin = role === 'admin';
  const canCreate = role === 'operator' || role === 'supervisor' || role === 'admin';

  // Admin-only edit mode: rename/describe/delete/add each container (row).
  const [editMode, setEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState<{ tabIndex: number; rowIndex: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Last persisted layout — Undo restores this, Save Ranges refreshes it
  const [savedTabs, setSavedTabs] = useState<EquipmentTab[]>(tabs);
  const hasLayoutChanges = layoutOf(tabData) !== layoutOf(savedTabs);

  // Hidden fill-in timer — uses timestamp, not a counter
  const timerStartRef = useRef<number | null>(null);
  useEffect(() => {
    timerStartRef.current = Date.now();
    return () => {
      timerStartRef.current = null;
    };
  }, [cardId]);

  function toggleSub(sub: string) {
    setSubFilter((prev) => ({ ...prev, [sub]: !prev[sub] }));
  }

  function isRowVisible(row: { group?: string; hidden?: boolean }): boolean {
    if (row.hidden) return false;
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

  function handleRowFieldChange(
    tabIndex: number,
    rowIndex: number,
    field: 'min' | 'norm' | 'max' | 'tagNo' | 'description' | 'unit',
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

  /** Persists the container layout to the sheet so changes survive navigation */
  async function persistLayout(data: EquipmentTab[]) {
    const allRows: string[][] = [];
    for (const tab of data) {
      for (const row of tab.rows) {
        allRows.push([tab.label, row.tagNo, row.unit, row.description, row.min, row.norm, row.max, row.hidden ? '1' : '']);
      }
    }
    const res = await fetch('/api/sheets/card-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'config', cardId, rows: allRows }),
    });
    if (!res.ok) throw new Error('Failed');
    setSavedTabs(data);
  }

  /** Applies a layout change locally and persists it to the sheet immediately.
   * The success toast waits for the sheet write so "saved" means saved — the
   * write takes a few seconds, and navigating back before it lands shows the
   * container as gone. */
  function applyAndPersist(next: EquipmentTab[], successMessage: string) {
    setTabData(next);
    const toastId = toast.loading(t('saving'));
    persistLayout(next)
      .then(() => toast.success(successMessage, { id: toastId }))
      .catch(() => toast.error(t('rangesSaveError'), { id: toastId }));
  }

  function handleToggleHidden(tabIndex: number, rowIndex: number) {
    const wasHidden = !!tabData[tabIndex]?.rows[rowIndex]?.hidden;
    const next = tabData.map((tab, i) =>
      i === tabIndex
        ? { ...tab, rows: tab.rows.map((row, j) => (j === rowIndex ? { ...row, hidden: !row.hidden } : row)) }
        : tab,
    );
    applyAndPersist(next, wasHidden ? t('containerShown') : t('containerHidden'));
  }

  function handleDeleteRow(tabIndex: number, rowIndex: number) {
    const next = tabData.map((tab, i) =>
      i === tabIndex
        ? { ...tab, rows: tab.rows.filter((_, j) => j !== rowIndex) }
        : tab,
    );
    applyAndPersist(next, t('containerDeleted'));
  }

  function handleAddContainer(values: ContainerEditValues) {
    const next = tabData.map((tab, i) =>
      i === activeTab
        ? { ...tab, rows: [...tab.rows, { ...values, value: '' }] }
        : tab,
    );
    applyAndPersist(next, t('containerAdded'));
  }

  function handleUndoChanges() {
    // Restore the last saved layout, keeping current process values by tag
    const valuesByTag = new Map<string, string>();
    for (const tab of tabData) {
      for (const row of tab.rows) valuesByTag.set(row.tagNo, row.value || '');
    }
    setTabData(
      savedTabs.map((tab) => ({
        ...tab,
        rows: tab.rows.map((row) => ({ ...row, value: valuesByTag.get(row.tagNo) ?? '' })),
      })),
    );
  }

  function handleDialogSave(values: ContainerEditValues) {
    if (!editingRow) return;
    const { tabIndex, rowIndex } = editingRow;
    const next = tabData.map((tab, i) =>
      i === tabIndex
        ? { ...tab, rows: tab.rows.map((row, j) => (j === rowIndex ? { ...row, ...values } : row)) }
        : tab,
    );
    applyAndPersist(next, t('containerUpdated'));
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
      // Fill-in duration (timestamp-based, no drift)
      let durationSeconds: number | null = null;
      if (timerStartRef.current) {
        durationSeconds = Math.max(1, Math.round((Date.now() - timerStartRef.current) / 1000));
      }

      // Record which A/B filter checkboxes were checked at save time
      const checkedSubs = Object.entries(subFilter)
        .filter(([, checked]) => checked)
        .map(([label]) => label)
        .join(', ');

      // Save via the new card-entries API (handles approval workflow + sheet sync)
      const res = await fetch('/api/card-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId, rows: allRows, duration_seconds: durationSeconds,
          filter: checkedSubs,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('saveSuccess'));
      setTabData((prev) =>
        prev.map((tab) => ({
          ...tab,
          rows: tab.rows.map((row) => ({ ...row, value: '' })),
        })),
      );
      // Reset the fill-in timer after save
      timerStartRef.current = Date.now();
    } catch (err) {
      toast.error((err as Error).message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRanges() {
    setSavingRanges(true);
    try {
      await persistLayout(tabData);
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
      {/* Admin edit-mode toolbar: toggle + add + undo */}
      {isAdmin && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
            className="rounded-lg"
          >
            <Settings2 className="h-4 w-4" />
            {editMode ? t('editModeOn') : t('editModeOff')}
          </Button>
          {editMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="rounded-lg"
              >
                <Plus className="h-4 w-4" />
                {t('addContainer')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndoChanges}
                disabled={!hasLayoutChanges}
                className="rounded-lg"
              >
                <Undo2 className="h-4 w-4" />
                {t('undoChanges')}
              </Button>
            </>
          )}
        </div>
      )}

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
          // A/B group filter applies to everyone; hidden rows render
          // only for admins in edit mode (so they can unhide)
          if (row.group && !subFilter[row.group]) return null;
          if (row.hidden && !(editMode && isAdmin)) return null;
          const outOfRange = isOutOfRange(row.value || '', row.min, row.max);
          // The tag code sits on its own line with the numbers under it
          const [tagCode, ...tagNumbers] = row.tagNo.split(' ');
          const stackedTag = tagNumbers.length > 0;
          return (
            <div key={i} className={`flex flex-col gap-1.5 ${row.hidden ? 'opacity-50' : ''}`}>
              {/* Edit-mode actions per container */}
              {editMode && (
                <div className="flex justify-end gap-1 items-center">
                  {row.hidden && (
                    <span className="text-xs font-medium text-muted-foreground px-1">
                      {t('hiddenBadge')}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 rounded-lg"
                    onClick={() => setEditingRow({ tabIndex: activeTab, rowIndex: i })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('editContainer')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 rounded-lg"
                    onClick={() => handleToggleHidden(activeTab, i)}
                  >
                    {row.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {row.hidden ? t('unhideContainer') : t('hideContainer')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2 rounded-lg"
                    onClick={() => handleDeleteRow(activeTab, i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('deleteContainer')}
                  </Button>
                </div>
              )}
              {/* Row 1: Tag No + Description */}
              <div className="flex gap-2">
                {editMode ? (
                  <Input
                    value={row.tagNo}
                    onChange={(e) => handleRowFieldChange(activeTab, i, 'tagNo', e.target.value)}
                    className="flex-1 min-w-0 h-9 text-center text-xs font-medium rounded-lg"
                  />
                ) : (
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
                )}
                {editMode ? (
                  <Input
                    value={row.description}
                    onChange={(e) => handleRowFieldChange(activeTab, i, 'description', e.target.value)}
                    className="flex-[2] min-w-0 h-9 text-center text-xs rounded-lg"
                  />
                ) : (
                  <div className="flex-[2] min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-xs overflow-hidden">
                    <span className="block w-full break-words leading-tight">{row.description}</span>
                  </div>
                )}
              </div>
              {/* Row 2: Process Value + Unit + Min/Norm/Max */}
              <div className="flex gap-2 items-stretch">
                <input
                  type="text"
                  value={row.value || ''}
                  onChange={(e) => handleValueChange(activeTab, i, e.target.value)}
                  disabled={!canCreate}
                  className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-center text-sm border focus:outline-none ${
                    outOfRange
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold'
                      : 'bg-card border-border focus:border-primary'
                  } ${!canCreate ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                {editMode ? (
                  <Input
                    value={row.unit}
                    onChange={(e) => handleRowFieldChange(activeTab, i, 'unit', e.target.value)}
                    className="flex-1 min-w-0 h-9 text-center text-sm rounded-lg"
                  />
                ) : (
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-center text-sm flex items-center justify-center">
                    {row.unit}
                  </div>
                )}
                {/* Min/Norm/Max stacked */}
                <div className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-card border border-border flex flex-col items-center justify-center gap-0.5">
                  {isAdmin ? (
                    <>
                      <input
                        type="text"
                        value={row.min}
                        onChange={(e) => handleRowFieldChange(activeTab, i, 'min', e.target.value)}
                        className="w-full max-w-[60px] text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.norm}
                        onChange={(e) => handleRowFieldChange(activeTab, i, 'norm', e.target.value)}
                        className="w-full max-w-[60px] text-center text-xs bg-transparent border-b border-border focus:outline-none pb-0.5"
                      />
                      <input
                        type="text"
                        value={row.max}
                        onChange={(e) => handleRowFieldChange(activeTab, i, 'max', e.target.value)}
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
      {!canSave && canCreate && (
        <p className="text-sm text-muted-foreground text-center">{t('allTabsRequired')}</p>
      )}

      {/* Save buttons */}
      <div className="flex justify-center gap-2">
        {isAdmin && (
          <Button variant="outline" onClick={handleSaveRanges} disabled={savingRanges || !hasLayoutChanges} className="rounded-lg">
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
        {canCreate && (
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
        )}
        {!canCreate && (
          <p className="text-sm text-muted-foreground text-center py-2">{t('engineerNoCreate')}</p>
        )}
      </div>

      <ContainerEditDialog
        open={!!editingRow}
        onOpenChange={(open) => !open && setEditingRow(null)}
        row={editingRow ? tabData[editingRow.tabIndex]?.rows[editingRow.rowIndex] ?? null : null}
        onSave={handleDialogSave}
      />
      <ContainerEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        row={null}
        mode="add"
        onSave={handleAddContainer}
      />
    </div>
  );
}
