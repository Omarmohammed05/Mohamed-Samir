import { CARD_DATA, type EquipmentTab, type CardInputRow } from '@/config/card-data';
import type { CardSheetData, SheetContainer } from '@/lib/card-sheets';

/**
 * Merges the hardcoded card defaults with the containers read from the
 * sheet (the sheet is the source of truth once it has a saved layout).
 * Pure function shared by the card page and the sync API.
 */
export function mergeCardData(
  defaultTabs: EquipmentTab[],
  sheetData: CardSheetData,
): EquipmentTab[] {
  // When the sheet has no saved layout (brand-new card or Sheets API unavailable),
  // fall back to the hardcoded defaults.
  if (sheetData.containers.length === 0) {
    return defaultTabs.map((tab) => ({
      ...tab,
      rows: tab.rows.map((row) => ({ ...row, value: '', hidden: false })),
    }));
  }

  // Index sheet containers by tagNo so we can look up saved config and detect
  // which containers exist in the sheet (the source of truth). Tags may be
  // duplicated, so each tag keeps a list; a default row matches the first
  // sheet container not claimed yet.
  const sheetByTag = new Map<string, SheetContainer[]>();
  for (const c of sheetData.containers) {
    const list = sheetByTag.get(c.tagNo) || [];
    list.push(c);
    sheetByTag.set(c.tagNo, list);
  }

  // Track which sheet containers are accounted for (by permanent ID, falling
  // back to tag when a container has no ID yet)
  const covered = new Set<string>();
  const coveredKey = (c: SheetContainer) => c.id || c.tagNo;

  // Start from the default tab structure (preserves ids, labels, subLabels,
  // tab order, and row order). Replace each row's config with the sheet's
  // saved values; rows absent from the sheet were deleted and are dropped.
  const resultTabs: EquipmentTab[] = defaultTabs.map((tab) => ({
    ...tab,
    rows: tab.rows
      .map((row): CardInputRow | null => {
        const sheet = (sheetByTag.get(row.tagNo) || []).find(
          (c) => !covered.has(coveredKey(c)),
        );
        if (!sheet) return null; // deleted from sheet
        covered.add(coveredKey(sheet));
        return {
          id: sheet.id, // permanent ID — carried through every save
          tagNo: sheet.tagNo,
          unit: sheet.unit,
          description: sheet.description,
          min: sheet.min,
          norm: sheet.norm,
          max: sheet.max,
          hidden: sheet.hidden,
          group: row.group, // preserve A/B sub-label from defaults
          value: '',
        };
      })
      .filter((r): r is CardInputRow => r !== null),
  }));

  // Add containers that exist in the sheet but not in the defaults (newly added).
  // Place each in the tab whose label matches the sheet's equipment header;
  // unknown or blank headers fall back to the last tab instead of creating
  // a "Custom" tab (the sheet is normalized on the next config save).
  const tabByLabel = new Map<string, EquipmentTab>();
  for (const tab of resultTabs) tabByLabel.set(tab.label, tab);

  for (const c of sheetData.containers) {
    if (covered.has(coveredKey(c))) continue;

    const targetTab =
      (c.equipment ? tabByLabel.get(c.equipment) : undefined) ??
      resultTabs[resultTabs.length - 1];
    if (!targetTab) continue;
    targetTab.rows.push({
      id: c.id, // permanent ID — carried through every save
      tagNo: c.tagNo,
      unit: c.unit,
      description: c.description,
      min: c.min,
      norm: c.norm,
      max: c.max,
      hidden: c.hidden,
      value: '',
    });
  }

  // Drop tabs whose every container was deleted from the sheet
  return resultTabs.filter((tab) => tab.rows.length > 0);
}

/** Convenience: merged tabs for a card id, or the defaults when unknown. */
export function emptySheetData(): CardSheetData {
  return { config: new Map(), containers: [], latestValues: new Map() };
}

/** Re-export so callers can resolve a card's default tabs in one import. */
export { CARD_DATA };
