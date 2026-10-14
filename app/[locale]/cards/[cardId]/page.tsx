import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { isValidCardId } from '@/config/cards';
import { CARD_DATA, type EquipmentTab } from '@/config/card-data';
import { getCardTabData } from '@/lib/card-sheets';
import { Header } from '@/components/header';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CardTabs } from '@/components/card-tabs';

function mergeCardData(defaultTabs: EquipmentTab[], savedRows: string[][]): EquipmentTab[] {
  const savedMap = new Map<string, string[]>();
  for (const row of savedRows) {
    const key = `${row[0]}|${row[1]}`;
    savedMap.set(key, row);
  }

  return defaultTabs.map((tab) => ({
    ...tab,
    rows: tab.rows.map((row) => {
      const key = `${tab.label}|${row.tagNo}`;
      const saved = savedMap.get(key);
      if (saved) {
        return {
          ...row,
          min: saved[4] !== undefined ? saved[4] : row.min,
          norm: saved[5] !== undefined ? saved[5] : row.norm,
          max: saved[6] !== undefined ? saved[6] : row.max,
        };
      }
      return row;
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

  // Try to read saved data from Google Sheets
  let savedRows: string[][] = [];
  try {
    const allData = await getCardTabData(id);
    savedRows = allData.slice(1).filter((row) => row.length > 0 && row.some((c) => c));
  } catch {
    // Tab doesn't exist or Sheets API not available — use defaults
  }

  const tabs = mergeCardData(defaultTabs, savedRows);

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/cards">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{id}</h1>
        </div>
        {tabs.length > 0 ? (
          <CardTabs cardId={id} tabs={tabs} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <p className="text-muted-foreground text-center">{t('cards.cardContent')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
