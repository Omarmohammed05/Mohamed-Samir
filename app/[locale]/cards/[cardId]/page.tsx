import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { isValidCardId } from '@/config/cards';
import { CARD_DATA, type EquipmentTab, type CardInputRow } from '@/config/card-data';
import { readCardSheetData, type CardSheetData, type SheetContainer } from '@/lib/card-sheets';
import { Header } from '@/components/header';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CardTabs } from '@/components/card-tabs';

function mergeCardData(
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
  // which containers exist in the sheet (the source of truth).
  const sheetByTag = new Map<string, SheetContainer>();
  for (const c of sheetData.containers) sheetByTag.set(c.tagNo, c);

  // Track which sheet containers are accounted for by default rows
  const coveredTags = new Set<string>();

  // Start from the default tab structure (preserves ids, labels, subLabels,
  // tab order, and row order). Replace each row's config with the sheet's
  // saved values; rows absent from the sheet were deleted and are dropped.
  const resultTabs: EquipmentTab[] = defaultTabs.map((tab) => ({
    ...tab,
    rows: tab.rows
      .map((row): CardInputRow | null => {
        const sheet = sheetByTag.get(row.tagNo);
        if (!sheet) return null; // deleted from sheet
        coveredTags.add(row.tagNo);
        return {
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
    if (coveredTags.has(c.tagNo)) continue;

    const targetTab =
      (c.equipment ? tabByLabel.get(c.equipment) : undefined) ??
      resultTabs[resultTabs.length - 1];
    if (!targetTab) continue;
    targetTab.rows.push({
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

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ locale: string; cardId: string }>;
}) {
  const { locale, cardId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  const id = cardId.toUpperCase();
  if (!isValidCardId(id)) {
    redirect(`/${locale}/cards`);
  }

  const defaultTabs = CARD_DATA[id] || [];

  let sheetData: CardSheetData = { config: new Map(), containers: [], latestValues: new Map() };
  try {
    sheetData = await readCardSheetData(id);
  } catch {
    // Tab doesn't exist or Sheets API not available — use defaults
  }

  const tabs = mergeCardData(defaultTabs, sheetData);

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-6 min-w-0">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/cards">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{id}</h1>
        </div>
        {tabs.length > 0 ? (
          <CardTabs cardId={id} tabs={tabs} role={session.role as 'operator' | 'supervisor' | 'engineer' | 'admin'} userEmail={session.email} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <p className="text-muted-foreground text-center">{t('cards.cardContent')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
