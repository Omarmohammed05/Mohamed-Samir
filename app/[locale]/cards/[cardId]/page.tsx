import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { isValidCardId } from '@/config/cards';
import { CARD_DATA } from '@/config/card-data';
import { readCardSheetData, backfillContainerIds, type CardSheetData } from '@/lib/card-sheets';
import { mergeCardData, emptySheetData } from '@/lib/card-merge';
import { Header } from '@/components/header';
import { CardView } from '@/components/card-view';

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ locale: string; cardId: string }>;
}) {
  const { locale, cardId } = await params;
  setRequestLocale(locale);
  const session = await getSession();

  if (!session) redirect(`/${locale}/login`);

  const id = cardId.toUpperCase();
  if (!isValidCardId(id)) {
    redirect(`/${locale}/cards`);
  }

  const defaultTabs = CARD_DATA[id] || [];

  let sheetData: CardSheetData = emptySheetData();
  try {
    sheetData = await readCardSheetData(id);
    // Additive migration: the first load after this update assigns permanent
    // IDs to existing containers that lack one (no container data is touched).
    // Re-read so the rendered rows carry their IDs into the next save.
    if (sheetData.containers.some((c) => !c.id)) {
      await backfillContainerIds(id);
      sheetData = await readCardSheetData(id);
    }
  } catch {
    // Tab doesn't exist or Sheets API not available — use defaults
  }

  const tabs = mergeCardData(defaultTabs, sheetData);

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-6 min-w-0">
        <CardView
          key={id}
          cardId={id}
          tabs={tabs}
          role={session.role as 'operator' | 'supervisor' | 'engineer' | 'admin'}
          userEmail={session.email}
        />
      </main>
    </div>
  );
}
