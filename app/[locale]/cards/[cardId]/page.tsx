import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { isValidCardId } from '@/config/cards';
import { CARD_DATA, type EquipmentTab } from '@/config/card-data';
import { readCardSheetData, type CardSheetData } from '@/lib/card-sheets';
import { Header } from '@/components/header';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CardTabs } from '@/components/card-tabs';

function mergeCardData(
  defaultTabs: EquipmentTab[],
  sheetData: CardSheetData,
): EquipmentTab[] {
  return defaultTabs.map((tab) => ({
    ...tab,
    rows: tab.rows.map((row) => {
      const savedConfig = sheetData.config.get(row.tagNo);
      const savedValue = sheetData.latestValues.get(row.tagNo);
      return {
        ...row,
        min: savedConfig?.min ?? row.min,
        norm: savedConfig?.norm ?? row.norm,
        max: savedConfig?.max ?? row.max,
        value: savedValue ?? row.value,
      };
    }),
  }));
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

  let sheetData: CardSheetData = { config: new Map(), latestValues: new Map() };
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
          <CardTabs cardId={id} tabs={tabs} role={session.role} userEmail={session.email} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <p className="text-muted-foreground text-center">{t('cards.cardContent')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
